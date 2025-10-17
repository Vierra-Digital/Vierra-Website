import React from 'react';
import { 
  FacebookShareButton, 
  LinkedinShareButton, 
  TwitterShareButton,
  FacebookIcon,
  LinkedinIcon,
  TwitterIcon
} from 'react-share';

interface SocialShareBarProps {
  url: string;
  title: string;
  description?: string;
}

const SocialShareBar: React.FC<SocialShareBarProps> = ({ url, title, description }) => {
  const hashtags = ['Vierra', 'Marketing', 'Business'];
  const shareTitle = `${title} - Vierra`;
  
  return (
    <div className="bg-white border-t border-[#E5E7EB] py-8">
      <div className="max-w-3xl mx-auto px-6 md:px-8 lg:px-20">
        <div className="flex flex-col items-center space-y-6">
          <h3 className="text-xl font-bold text-[#111827]">Share This Article</h3>
          <div className="flex items-center space-x-6">
            <FacebookShareButton
              url={url}
              hashtag="#Vierra"
              className="flex items-center justify-center transition-all duration-300 hover:scale-110"
            >
              <FacebookIcon size={40} round={false} />
            </FacebookShareButton>
            
            <LinkedinShareButton
              url={url}
              title={shareTitle}
              summary={description || ''}
              className="flex items-center justify-center transition-all duration-300 hover:scale-110"
            >
              <LinkedinIcon size={40} round={false} />
            </LinkedinShareButton>
            
            <TwitterShareButton
              url={url}
              title={shareTitle}
              hashtags={hashtags}
              className="flex items-center justify-center transition-all duration-300 hover:scale-110"
            >
              <TwitterIcon size={40} round={false} />
            </TwitterShareButton>
          </div>
          <p className="text-sm text-[#6B7280] text-center max-w-md">
            Help others discover this article by sharing it on social media.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SocialShareBar;
