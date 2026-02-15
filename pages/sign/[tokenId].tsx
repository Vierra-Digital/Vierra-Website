import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import { Document, Page, pdfjs } from 'react-pdf';
import SignatureCanvas from 'react-signature-canvas';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import { FiCheck, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { getSessionData } from '@/lib/sessionStore';
import type { PdfField } from '@/lib/sessionStore';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
}

const inter = Inter({ subsets: ['latin'] });

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
  const [fields, setFields] = useState<PdfField[]>([]);
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
  const sigRefs = useRef<Record<string, SignatureCanvas | null>>({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageRefs = useRef<{ [page: number]: HTMLDivElement | null }>({});

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
        const fs = data.fields ?? (data.coordinates ? [{
          type: 'signature' as const,
          page: data.coordinates.page,
          xRatio: data.coordinates.xRatio,
          yRatio: data.coordinates.yRatio,
          width: data.coordinates.width,
          height: data.coordinates.height,
          id: 'legacy',
        }] : []);
        if (fs.length === 0) {
          throw new Error('Fields or coordinates not found in session data.');
        }
        setFields(fs);
        setSessionDetails({ 
          originalFilename: data.originalFilename, 
          pdfBase64: data.pdfBase64
        });

        if (data.pdfBase64) {
          const arrayBuffer = base64ToArrayBuffer(data.pdfBase64);
          setPdfData({ data: arrayBuffer });
        } else {
          setError("Document not available. The signing session may have expired.");
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
    Object.values(sigRefs.current).forEach(ref => ref?.clear());
    setError(null);
  };

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setSignerEmail(email);
    setIsEmailValid(email === '' || validateEmail(email));
  };

  const handleSubmit = async () => {
    const signatureFields = fields.filter(f => f.type === 'signature');
    const allSigned = signatureFields.every(f => {
      const ref = sigRefs.current[f.id ?? 'legacy'];
      return ref && !ref.isEmpty();
    });
    if (!allSigned || signatureFields.length === 0) {
      setError('Please fill in all designated signature areas first.');
      return;
    }

    const textFields = fields.filter(f => f.type === 'text');
    const allTextFilled = textFields.every(f => {
      const val = (textValues[f.id ?? ''] ?? '').trim();
      return val.length > 0;
    });
    if (textFields.length > 0 && !allTextFilled) {
      setError('Please fill in all text boxes before submitting.');
      return;
    }

    if (signerEmail && !validateEmail(signerEmail)) {
      setIsEmailValid(false);
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const signatures: Record<string, string> = {};
    for (const f of signatureFields) {
      const ref = sigRefs.current[f.id ?? 'legacy'];
      if (ref) signatures[f.id ?? 'legacy'] = ref.toDataURL('image/png');
    }
    try {
      const response = await fetch('/api/submitSignature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tokenId, 
          signatures,
          textValues,
          email: signerEmail || undefined,
        }),
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
    return (
      <div className={`min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4 ${inter.className}`}>
        <div className="text-[#374151]">Invalid or missing token.</div>
      </div>
    );
  }

  if (isLoadingDetails) {
    return (
      <div className={`min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 ${inter.className}`}>
        <div className="w-14 h-14 rounded-full border-4 border-[#7A13D0]/20 border-t-[#7A13D0] animate-spin mb-4" />
        <p className="text-[#6B7280]">Loading Signing Details...</p>
      </div>
    );
  }

  if ((error && fields.length === 0) || !tokenId) {
    const errorMessage = !tokenId ? "Invalid or missing token." : error || "Could not load signing fields.";
    return (
      <div className={`min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 ${inter.className}`}>
        <div className="text-red-500 font-medium">{errorMessage}</div>
      </div>
    );
  }

  const textFields = fields.filter((f) => f.type === 'text');
  const allTextFilled = textFields.length === 0 || textFields.every((f) => ((textValues[f.id ?? ''] ?? '') as string).trim().length > 0);

  return (
    <>
      <Head>
        <title>Vierra | Sign {sessionDetails?.originalFilename || 'Document'}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className={`min-h-screen bg-[#FAFAFA] text-[#111827] overflow-auto ${inter.className}`}>
        <header className="bg-white border-b border-[#E5E7EB] px-4 lg:px-6 py-2 flex items-center justify-between">
          <div className="h-12 lg:h-14 w-32 lg:w-36 overflow-hidden flex items-center shrink-0">
            <Image
              src="/assets/vierra-logo-black.png"
              alt="Vierra"
              width={320}
              height={96}
              className="h-full w-full object-cover object-center"
              priority
            />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 lg:px-6 py-8">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
            {isSubmitted ? (
              <div className="p-6 lg:p-10 text-center">
                <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center mx-auto">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                  <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                      <FiCheck className="h-6 w-6" />
                    </span>
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-[#111827] mb-2">Signature Successfully Submitted!</h2>
                <p className="text-sm text-[#6B7280]">Your signed document has been processed and sent to the Vierra team.</p>
                <p className="text-sm text-[#6B7280] mt-4">
                  Redirecting in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
                </p>
              </div>
            ) : (
              <>
                <div className="p-6 lg:p-8 border-b border-[#E5E7EB] bg-white">
                  <h2 className="text-lg font-semibold text-[#111827] mb-1">
                    Sign Your Document
                  </h2>
                  <p className="text-sm text-[#6B7280]">Fill out all text boxes and signatures to complete the document.</p>
                </div>
                <div className="p-6 lg:p-8 bg-[#FAFAFA]">
                  <div className="flex items-start justify-center overflow-auto max-h-[70vh] min-h-[400px] rounded-lg">
                    <Document
                      file={pdfData}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={(err) => { setError(`Failed to load PDF document: ${err.message}`); }}
                      loading={<div className="text-[#6B7280] p-10">Loading PDF Document...</div>}
                      className="flex flex-col items-center"
                    >
                      {numPages > 0 && (() => {
                        const pageNumber = currentPage;
                        const pageFields = fields.filter(f => f.page === pageNumber);
                        const currentPageDimensions = pageDimensions[pageNumber];

                        return (
                          <div
                            key={`page_${pageNumber}`}
                            ref={el => { pageRefs.current[pageNumber] = el; }}
                            className="relative inline-block rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
                          >
                            <Page
                              pageNumber={pageNumber}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              onLoadSuccess={(page) => onPageLoadSuccess({
                                pageNumber: page.pageNumber,
                                width: page.width,
                                height: page.height
                              })}
                              onRenderError={() => setError(`Failed to render page ${pageNumber}.`)}
                            />
                            {pageFields.map((field) => {
                            if (!pageRefs.current[pageNumber] || !currentPageDimensions) return null;
                            const pageElement = pageRefs.current[pageNumber];
                            const scale = pageElement ? pageElement.clientWidth / currentPageDimensions.width : 1;
                            const boxWidth = field.width * scale;
                            const boxHeight = field.height * scale;
                            const boxLeft = field.xRatio * pageElement!.clientWidth;
                            const boxTop = field.yRatio * pageElement!.clientHeight;

                            const boxStyle: React.CSSProperties = {
                              position: 'absolute',
                              top: `${boxTop}px`,
                              left: `${boxLeft}px`,
                              width: `${boxWidth}px`,
                              height: `${boxHeight}px`,
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: '2px dashed #7A13D0',
                              borderRadius: '6px',
                              zIndex: 10,
                              display: 'block',
                              boxShadow: '0 2px 8px rgba(122, 19, 208, 0.2)',
                            };

                            return (
                              <div key={field.id ?? `${field.page}-${field.xRatio}`} style={boxStyle} onClick={(e) => e.stopPropagation()}>
                                {field.type === 'signature' && (
                                  <>
                                    <span className="text-xs font-semibold text-[#7A13D0] absolute -top-5 left-0 bg-white px-1.5 py-0.5 rounded border border-[#E5E7EB]">Sign Here</span>
                                    <SignatureCanvas
                                      ref={el => { if (el) sigRefs.current[field.id ?? 'legacy'] = el; }}
                                      penColor="#374151"
                                      minWidth={0.5}
                                      maxWidth={1.5}
                                      canvasProps={{ width: field.width, height: field.height, style: { width: '100%', height: '100%', borderRadius: '4px' } }}
                                    />
                                  </>
                                )}
                                {field.type === 'date' && (
                                  <span className="text-xs text-[#374151] flex items-center justify-center h-full p-1 font-medium">Date: {new Date().toLocaleDateString()}</span>
                                )}
                                {field.type === 'text' && (
                                  <input
                                    type="text"
                                    placeholder="Enter text..."
                                    value={textValues[field.id ?? ''] ?? ''}
                                    onChange={(e) => setTextValues(prev => ({ ...prev, [field.id ?? '']: e.target.value }))}
                                    className="w-full h-full text-xs px-2 border-0 bg-transparent focus:outline-none focus:ring-0 text-[#374151] placeholder:text-[#9CA3AF]"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        );
                      })()}
                    </Document>
                  </div>
                  {numPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#7A13D0] hover:text-[#7A13D0] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#E5E7EB] disabled:hover:text-[#374151] transition"
                      >
                        <FiChevronLeft className="w-4 h-4" />
                        Prev
                      </button>
                      <span className="text-sm text-[#6B7280] min-w-[5rem] text-center">
                        {currentPage} / {numPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(numPages ?? 1, p + 1))}
                        disabled={currentPage >= (numPages ?? 1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#7A13D0] hover:text-[#7A13D0] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#E5E7EB] disabled:hover:text-[#374151] transition"
                      >
                        Next
                        <FiChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {fields.length > 0 && (
                    <div className="p-6 lg:p-8 border-t border-[#E5E7EB] bg-white">
                    <div className="max-w-md mx-auto mb-4">
                      <label className="block text-sm font-medium text-[#374151] mb-1">
                        Add Your Email (Optional) To Receive A Copy
                      </label>
                      <input
                        type="email"
                        value={signerEmail}
                        onChange={handleEmailChange}
                        className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7A13D0]/20 focus:border-[#7A13D0] ${
                          isEmailValid ? 'border-[#E5E7EB] bg-[#FAFAFA]' : 'border-red-500 bg-red-50'
                        }`}
                        placeholder="your.email@example.com"
                      />
                      {!isEmailValid && (
                        <p className="text-sm text-red-500 mt-1">Please enter a valid email address.</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                      <button
                        onClick={handleClear}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Clear Signature
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !allTextFilled}
                        className="px-6 py-2.5 bg-[#7A13D0] text-white rounded-xl font-medium text-sm hover:bg-[#6B11B8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[#7A13D0]/20"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Signature'}
                      </button>
                    </div>
                    {error && !isSubmitting && (
                      <p className="text-red-500 mt-4 text-center text-sm font-medium">{error}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const tokenId = ctx.params?.tokenId;
  if (!tokenId || typeof tokenId !== 'string') {
    return { notFound: true };
  }
  const session = await getSessionData(tokenId);
  if (!session || session.status === 'signed' || session.status === 'expired') {
    return { notFound: true };
  }
  return { props: {} };
};

export default SignDocumentPage;
