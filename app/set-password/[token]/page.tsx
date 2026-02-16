"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Inter } from "next/font/google";
import { Eye, EyeOff } from "lucide-react";
import { FiCheck } from "react-icons/fi";

const inter = Inter({ subsets: ["latin"] });

export default function SetPasswordPage() {
    const router = useRouter();
    const params = useParams();
    const token = params?.token as string | undefined;
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!token) {
            setError("Invalid link. Please use the link from your email.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch("/api/auth/setPassword", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "Failed to set password.");
            }

            setSuccess(true);
            setTimeout(() => router.push("/login"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to set password.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!token) {
        return (
            <div className={`min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 ${inter.className}`}>
                <div className="text-[#374151]">Invalid or missing link. Please use the link from your email.</div>
            </div>
        );
    }

    return (
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

            <main className="max-w-md mx-auto px-4 lg:px-6 py-8">
                <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                    {success ? (
                        <div className="p-6 lg:p-10 text-center">
                            <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center mx-auto">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                                        <FiCheck className="h-6 w-6" />
                                    </span>
                                </span>
                            </div>
                            <h2 className="text-lg font-semibold text-[#111827] mb-2">Password Set Successfully!</h2>
                            <p className="text-sm text-[#6B7280]">Redirecting to login...</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-6 lg:p-8 border-b border-[#E5E7EB] bg-white">
                                <h2 className="text-lg font-semibold text-[#111827] mb-1">Password Reset</h2>
                                <p className="text-sm text-[#6B7280]">Create a password to access your Vierra account.</p>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 lg:p-8">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="password" className="block text-sm font-medium text-[#374151] mb-1">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                id="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#701CC0]/20 focus:border-[#701CC0] bg-[#F9FAFB]"
                                                placeholder="Enter password (min 6 characters)"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                aria-label={showPassword ? "Hide password" : "Show password"}
                                                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#6B7280] hover:text-[#374151]"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#374151] mb-1">
                                            Confirm Password
                                        </label>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            id="confirmPassword"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#701CC0]/20 focus:border-[#701CC0] bg-[#F9FAFB]"
                                            placeholder="Confirm your password"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                                {error && (
                                    <p className="mt-4 text-red-500 text-sm">{error}</p>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="mt-6 w-full px-6 py-2.5 bg-[#701CC0] text-white rounded-lg font-medium text-sm hover:bg-[#5F18B0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSubmitting ? "Setting Password..." : "Set Password"}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
