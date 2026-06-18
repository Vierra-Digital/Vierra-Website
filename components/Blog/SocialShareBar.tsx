import {
  FacebookShareButton,
  LinkedinShareButton,
  TwitterShareButton,
} from 'react-share';
import { Bricolage_Grotesque, Inter } from 'next/font/google';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });

interface SocialShareBarProps {
  url: string;
  title: string;
  description?: string;
}

const buttonClass =
  'flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EEFC] text-[#701CC0] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#701CC0] hover:text-white';

const SocialShareBar: React.FC<SocialShareBarProps> = ({ url, title, description }) => {
  const hashtags = ['Vierra', 'Marketing', 'Business'];
  const shareTitle = `${title} - Vierra`;

  return (
    <div className="bg-[#F3F3F3] px-6 md:px-8 lg:px-20">
      <div className="mx-auto max-w-5xl pt-16 pb-4">
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-[#ECE6F5] bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#A98FD1]">
            Share
          </span>
          <h3 className={`text-2xl font-bold tracking-tight text-[#18042A] md:text-3xl ${bricolage.className}`}>
            Share This Article
          </h3>
          <p className={`mt-1 max-w-md text-sm text-[#64607D] ${inter.className}`}>
            Help others discover this article by sharing it.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <LinkedinShareButton url={url} title={shareTitle} summary={description || ''}>
              <span className={buttonClass} aria-label="Share on LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.2h.05c.53-1 1.83-2.2 3.77-2.2 4.03 0 4.78 2.65 4.78 6.1V24h-4v-7.1c0-1.7-.03-3.9-2.37-3.9-2.37 0-2.74 1.85-2.74 3.77V24h-4V8z" />
                </svg>
              </span>
            </LinkedinShareButton>

            <FacebookShareButton url={url} hashtag="#Vierra">
              <span className={buttonClass} aria-label="Share on Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
                </svg>
              </span>
            </FacebookShareButton>

            <TwitterShareButton url={url} title={shareTitle} hashtags={hashtags}>
              <span className={buttonClass} aria-label="Share on X">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </span>
            </TwitterShareButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialShareBar;
