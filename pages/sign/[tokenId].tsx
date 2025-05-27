import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Document, Page, pdfjs } from 'react-pdf';
import SignatureCanvas from 'react-signature-canvas';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import Image from 'next/image';
import Script from 'next/script';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import type { SessionData } from '@/lib/sessionStore';

declare global {
  interface Window {
    particlesJS: {
      load: (tagId: string, path: string, callback?: () => void) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });

type SigningCoordinates = SessionData['coordinates'];

// Helper function to convert base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const SignDocumentPage: React.FC = () => {
  const router = useRouter();
  const { tokenId } = router.query as { tokenId?: string };
  const [numPages, setNumPages] = useState<number>(0);
  const [fetchedCoords, setFetchedCoords] = useState<SigningCoordinates | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ [page: number]: { width: number; height: number } }>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [sessionDetails, setSessionDetails] = useState<{ originalFilename: string; pdfBase64?: string } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(5);
  const [signerEmail, setSignerEmail] = useState<string>('');
  const [isEmailValid, setIsEmailValid] = useState<boolean>(true);
  const [pdfData, setPdfData] = useState<string | ArrayBuffer | { data: ArrayBuffer } | null>(null);
  const [usingBase64, setUsingBase64] = useState<boolean>(false);
  const sigRef = useRef<SignatureCanvas>(null);
  const pageRefs = useRef<{ [page: number]: HTMLDivElement | null }>({});

  const initParticles = () => {
    if (typeof window !== 'undefined' && window.particlesJS) {
      window.particlesJS.load('particles-container', '/particles-config.json', () => {
        console.log('particles.js loaded - callback');
      });
    }
  };

  useEffect(() => {
    if (!tokenId) {
      setError("Invalid or missing token.");
      setIsLoadingDetails(false);
      return;
    }

    const fetchDetails = async () => {
      setIsLoadingDetails(true);
      setError(null);
      try {
        const response = await fetch(`/api/getSigningSession?tokenId=${tokenId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch details (${response.status})`);
        }
        const data = await response.json();
        if (!data.coordinates) {
          throw new Error('Coordinates not found in session data.');
        }
        setFetchedCoords(data.coordinates);
        setSessionDetails({ 
          originalFilename: data.originalFilename, 
          // Store base64 PDF if available
          pdfBase64: data.pdfBase64
        });

        // Process PDF data - either URL or base64
        if (data.pdfBase64) {
          setUsingBase64(true);
          // Convert base64 to ArrayBuffer for PDF.js
          const arrayBuffer = base64ToArrayBuffer(data.pdfBase64);
          setPdfData({ data: arrayBuffer });
        } else {
          setUsingBase64(false);
          setPdfData(`/signing_pdfs/${tokenId}.pdf`);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message || 'Failed to load signing details.');
        } else {
          setError('An unknown error occurred.');
        }
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [tokenId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isSubmitted) {
      setRedirectCountdown(5);
      interval = setInterval(() => {
        setRedirectCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(interval!);
            router.push('/');
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isSubmitted, router]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const onPageLoadSuccess = useCallback((page: { pageNumber: number; width: number; height: number }) => {
    setPageDimensions(prev => ({
      ...prev,
      [page.pageNumber]: { width: page.width, height: page.height }
    }));
  }, []);

  const handleClear = () => {
    sigRef.current?.clear();
    setError(null);
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Handle email input changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setSignerEmail(email);
    setIsEmailValid(email === '' || validateEmail(email));
  };
  

  const handleSubmit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty() || !fetchedCoords) {
      setError('Please sign in the designated area first.');
      return;
    }

    // Validate email
    if (signerEmail && !validateEmail(signerEmail)) {
      setIsEmailValid(false);
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const img = sigRef.current.toDataURL('image/png');
    try {
      const response = await fetch('/api/submitSignature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tokenId, 
          signature: img, 
          position: fetchedCoords,
          email: signerEmail || undefined // Include email in submission payload and only if it is provided
          })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Submission failed (${response.status})`);
      }
      setIsSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during submission.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tokenId) {
    return <div className="p-4 text-center">Invalid or missing token.</div>;
  }

  // const pdfFileUrl = `/signing_pdfs/${tokenId}.pdf`;

  if (isLoadingDetails) {
    return <div className="p-4 text-center text-white">Loading signing details...</div>;
  }

  if ((error && !fetchedCoords) || !tokenId) {
    const errorMessage = !tokenId ? "Invalid or missing token." : error || "Could not load signature coordinates.";
    return <div className="p-4 text-center text-red-500">{errorMessage}</div>;
  }

  return (
    <>
      <Head>
        <title>Vierra | Sign {sessionDetails?.originalFilename || 'Document'}</title>
      </Head>
      <Script
        src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"
        strategy="afterInteractive"
        onLoad={initParticles}
      />
      <div className={`relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] text-white p-4 md:p-8 ${inter.className} animate-gradient-move`}>
        <div id="particles-container" className="absolute inset-0 z-0 w-full h-full"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex justify-center mb-8">
            <Image src="/assets/vierra-logo.png" alt="Vierra Logo" width={150} height={50} className="w-auto h-12" />
          </div>
          <h1 className={`text-3xl md:text-4xl font-bold mb-8 text-center ${bricolage.className}`}>
            {isSubmitted ? 'Signature Submitted' : 'Sign Your Document'}
          </h1>
          <div className="w-full max-w-5xl mx-auto bg-[#18042A]/90 border border-[#701CC0]/60 backdrop-blur-md rounded-lg p-4 md:p-8 shadow-2xl">
            {isSubmitted ? (
              <div className="text-center py-10 px-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400 mx-auto mb-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className={`text-2xl font-bold mb-3 ${bricolage.className}`}>Signature Successfully Submitted!</h2>
                <p className="text-gray-300">Your signed document has been processed and sent to the Vierra team.</p>
                <p className="text-gray-300 mt-4 text-sm">
                  Redirecting to homepage in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
                </p>
              </div>
            ) : (
              <>
                <div className="pdf-viewer-container w-full max-h-[70vh] overflow-auto flex justify-center mb-6 bg-gray-800/30 rounded p-2">
                  <Document
                    file={pdfData}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(err) => { setError(`Failed to load PDF document: ${err.message}`); }}
                    loading={<div className="text-white p-10">Loading PDF document...</div>}
                    className="flex flex-col items-center"
                  >
                    {Array.from({ length: numPages ?? 0 }, (_v, i) => {
                      const pageNumber = i + 1;
                      let sigBoxStyle: React.CSSProperties = { display: 'none' };
                      const currentPageDimensions = pageDimensions[pageNumber];

                      if (fetchedCoords && fetchedCoords.page === pageNumber && currentPageDimensions && pageRefs.current[pageNumber]) {
                        const pageElement = pageRefs.current[pageNumber];
                        const scale = pageElement ? pageElement.clientWidth / currentPageDimensions.width : 1;
                        const boxWidth = fetchedCoords.width * scale;
                        const boxHeight = fetchedCoords.height * scale;
                        const boxLeft = fetchedCoords.xRatio * pageElement.clientWidth;
                        const boxTop = fetchedCoords.yRatio * pageElement.clientHeight;

                        sigBoxStyle = {
                          position: 'absolute',
                          top: `${boxTop}px`,
                          left: `${boxLeft}px`,
                          width: `${boxWidth}px`,
                          height: `${boxHeight}px`,
                          backgroundColor: 'rgba(255, 255, 255, 0.85)',
                          border: '2px dashed #A050FF',
                          borderRadius: '4px',
                          zIndex: 10,
                          cursor: 'crosshair',
                          display: 'block',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                        };
                      }

                      return (
                        <div
                          key={`page_${pageNumber}`}
                          ref={el => { pageRefs.current[pageNumber] = el; }}
                          style={{ position: 'relative', marginBottom: '1rem', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                        >
                          <Page
                            pageNumber={pageNumber}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            width={Math.min(window.innerWidth * 0.95, 900)}
                            onLoadSuccess={(page) => onPageLoadSuccess({
                              pageNumber: page.pageNumber,
                              width: page.width,
                              height: page.height
                            })}
                            onRenderError={() => setError(`Failed to render page ${pageNumber}.`)}
                          />
                          {fetchedCoords && fetchedCoords.page === pageNumber && (
                            <div
                              style={sigBoxStyle}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-xs font-semibold text-purple-800 absolute -top-5 left-0 bg-white/80 px-1 rounded">Sign Here:</span>
                              <SignatureCanvas
                                ref={sigRef}
                                penColor="#333333"
                                minWidth={0.5}
                                maxWidth={1.5}
                                canvasProps={{ width: fetchedCoords.width, height: fetchedCoords.height, style: { width: '100%', height: '100%', borderRadius: '3px' } }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Document>
                </div>
                {fetchedCoords && (
                  <div className="mt-6 flex flex-col items-center">
                    {/* Add email input field */}
                    <div className="mb-4 w-full max-w-md">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Your Email Address (optional - to receive a copy of the signed document)
                      </label>
                      <input
                        type="email"
                        value={signerEmail}
                        onChange={handleEmailChange}
                        className={`w-full px-4 py-2 bg-gray-800 border ${isEmailValid ? 'border-gray-600' : 'border-red-500'} rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#701CC0]`}
                        placeholder="your.email@example.com"
                      />
                      {!isEmailValid && (
                        <p className="text-sm text-red-500 mt-1">Please enter a valid email address</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                      <button
                        onClick={handleClear}
                        disabled={isSubmitting}
                        className={`px-6 py-2 bg-gray-600 text-white rounded-md shadow-md transform transition-all duration-300 hover:scale-105 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                      >
                        Clear Signature
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`px-6 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-all duration-300 hover:scale-105 hover:bg-[#8F42FF] disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Signature'}
                      </button>
                    </div>
                    {error && !isSubmitting && (
                      <p className="text-red-500 mt-4 text-center font-semibold animate-pulse">{error}</p>
                    )}
                  </div>
                )}
                {numPages > 0 && <p className="text-center text-gray-400 mt-6 text-sm">Document Pages: {numPages}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SignDocumentPage;