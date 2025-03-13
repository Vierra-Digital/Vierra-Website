import React from "react";
import { Button } from "./button";

interface ModalProps {
  onRetry: () => void;
  gracePeriod?: boolean;
  daysLeft?: number;
}

const Modal: React.FC<ModalProps> = ({
  onRetry,
  gracePeriod = false,
  daysLeft = 0,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">
            {gracePeriod ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-yellow-500"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2 text-red-500">
            {gracePeriod ? "Trial Period Active" : "License Expired"}
          </h2>

          <p className="text-gray-600 mb-6">
            {gracePeriod
              ? `This website is in trial mode. ${daysLeft} days remaining before full payment is required.`
              : "This website's license has expired. Please contact the developer to activate the full version."}
          </p>

          <div className="flex flex-col gap-4 w-full">
            <Button onClick={onRetry} variant="outline">
              Retry Validation
            </Button>

            <a href="mailto:darshdoshi01@email.com" className="inline-block">
              <Button className="w-full">Contact Developer</Button>
            </a>

            {!gracePeriod && (
              <p className="text-sm text-gray-500 mt-2">
                If you&apos;ve already made a payment, please allow up to 24
                hours for activation.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
