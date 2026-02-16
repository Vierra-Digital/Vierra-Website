import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Password Reset",
    robots: { index: false, follow: false },
};

export default function SetPasswordLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
