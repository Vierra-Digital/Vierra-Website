import React, { useState } from "react";
import Image from "next/image";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    particlesJS: {
      load: (tagId: string, path: string, callback?: () => void) => void;
    };
    pJSDom?: { pJS: Record<string, unknown> }[];
  }
}

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const initParticles = () => {
    if (typeof window !== "undefined" && window.particlesJS) {
      window.particlesJS.load("particles-container", "/particles-config.json", () => {});
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch("/users.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const users = await response.json();

      type User = { username: string; password: string };
      const user = (users as User[]).find(
        (u) => u.username === username && u.password === password
      );

      if (user) {
        localStorage.setItem("isAuthenticated", "true");
        router.push("/panel");
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("Login failed. Please check credentials or network.");
    }
  };

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"
        strategy="afterInteractive"
        onLoad={initParticles}
      />

      <div className="relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] animate-gradient-move flex items-center justify-center overflow-hidden">
        <div id="particles-container" className="absolute inset-0 z-0 w-full h-full"></div>
        <div className="relative bg-white/10 backdrop-blur-md rounded-lg p-8 w-[90%] max-w-md shadow-lg z-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/assets/vierra-logo.png"
              alt="Vierra Logo"
              width={150}
              height={50}
              className="w-auto h-12"
            />
          </div>
          <h2
            className={`text-2xl font-bold text-white text-center mb-4 ${bricolage.className}`}
          >
            Admin Login
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className={`block text-sm font-medium text-white ${inter.className}`}
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 bg-[#18042A] text-white placeholder-gray-400"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className={`block text-sm font-medium text-white ${inter.className}`}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 pr-10 bg-[#18042A] text-white placeholder-gray-400"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 ${inter.className}`}
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default LoginPage;