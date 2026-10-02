import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, verifyOtp } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [orgDetails, setOrgDetails] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Fetch organization details (public endpoint - no auth needed)
    const fetchOrgDetails = async () => {
      try {
        const response = await fetch("/api/organization-details");
        if (response.ok) {
          const data = await response.json();
          const details = data.data || data;
          console.log("Fetched organization details:", details);
          setOrgDetails(details);
        } else {
          console.log("Failed to fetch organization details, status:", response.status);
        }
      } catch (err) {
        console.error("Could not fetch organization details:", err);
      }
    };
    fetchOrgDetails();
  }, []);

  useEffect(() => {
    // Auto-rotate images every 3 seconds
    if (orgDetails?.loginImages && orgDetails.loginImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % orgDetails.loginImages.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [orgDetails?.loginImages]);

  // set while the one-time code is awaited: { challenge, sentTo }
  const [otp, setOtp] = useState(null);
  const [code, setCode] = useState("");

  async function submitCode(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(otp.challenge, code);
      nav("/");
    } catch (err) {
      setError(err.message || "Could not verify the code");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(email, password);
      // this user type signs in with a one-time code as well
      if (result?.otpRequired) {
        setOtp({ challenge: result.challenge, sentTo: result.sentTo });
        setCode("");
        return;
      }
      nav("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fff", alignItems: "center", justifyContent: "flex-start", padding: "20px", gap: "12px", overflow: "hidden" }}>
      {/* Left Side - Brand/Journey with Images/Video */}
      <div
        style={{
          flex: "0 0 70%",
          background: orgDetails?.loginVideo
            ? "transparent"
            : orgDetails?.loginImages?.length
            ? `url(${orgDetails.loginImages[currentImageIndex]}) center/cover no-repeat`
            : "linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7aa8da 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px 40px",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          borderRadius: "20px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          height: "calc(100vh - 40px)",
        }}
      >
        {/* Video Display */}
        {orgDetails?.loginVideo && (
          <video
            src={orgDetails.loginVideo}
            autoPlay
            muted
            loop
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 1,
            }}
          />
        )}

        {/* Overlay - removed to keep images bright */}

        {/* Image carousel dots */}
        {orgDetails?.loginImages && orgDetails.loginImages.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 8,
              zIndex: 3,
            }}
          >
            {orgDetails.loginImages.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: idx === currentImageIndex ? "#fff" : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  border: "1px solid white",
                }}
              />
            ))}
          </div>
        )}

        <div style={{ maxWidth: 400, textAlign: "center", zIndex: 4, position: "relative" }}>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div
        style={{
          flex: "0 0 30%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "0",
          background: "transparent",
        }}
      >
        <div style={{ width: "100%", maxWidth: 320 }}>
          {/* Logo & Organization Name */}
          {(orgDetails?.logo || orgDetails?.name) && (
            <div
              style={{
                display: "flex",
                flexDirection: orgDetails?.loginLayout === "side-by-side" ? "row" : "column",
                gap: orgDetails?.loginLayout === "side-by-side" ? 12 : 8,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 32,
              }}
            >
              {orgDetails?.logo && (
                <img
                  src={orgDetails.logo}
                  alt="Organization Logo"
                  style={{
                    maxWidth: `${orgDetails.logoWidth || 120}px`,
                    maxHeight: `${orgDetails.logoHeight || 120}px`,
                    objectFit: "contain",
                    borderRadius: `${orgDetails.logoBorderRadius || 0}px`,
                  }}
                />
              )}
              {/* divs, not h1/p: a global stylesheet forces heading/paragraph colors with !important */}
              <div style={{ textAlign: orgDetails?.loginLayout === "side-by-side" ? "left" : "center" }}>
                {orgDetails?.name && (
                  <div style={{ fontSize: `${orgDetails.nameFontSize || 24}px`, fontWeight: 700, lineHeight: 1.2, color: orgDetails.nameColor || "#222" }}>
                    {orgDetails.name}
                  </div>
                )}
                {orgDetails?.tagline && (
                  <div style={{ fontSize: `${orgDetails.taglineFontSize || 14}px`, color: orgDetails.taglineColor || "#666", marginTop: 4 }}>
                    {orgDetails.tagline}
                  </div>
                )}
              </div>
            </div>
          )}


          {error && (
            <div style={{
              padding: 12,
              marginBottom: 20,
              background: "#fee",
              border: "1px solid #fcc",
              borderRadius: 8,
              color: "#c33",
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {otp ? (
            <form onSubmit={submitCode}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 6 }}>Enter the sign-in code</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Sent to {otp.sentTo}</div>
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={{ width: "100%", padding: "12px 16px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 20, letterSpacing: 8, textAlign: "center", marginBottom: 16, boxSizing: "border-box" }}
              />
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="login-submit"
                style={{ width: "100%", padding: "12px 16px", background: busy || code.length < 6 ? "#999" : "#217E79", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy || code.length < 6 ? "not-allowed" : "pointer", marginBottom: 12 }}
              >
                {busy ? "Checking..." : "Verify and sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setOtp(null); setError(null); }}
                style={{ width: "100%", padding: "10px 16px", background: "transparent", color: "#217E79", border: "none", fontSize: 13, cursor: "pointer" }}
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <form onSubmit={submit}>
            {/* Email Field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>
                Email / Username
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email or username"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#217E79")}
                onBlur={(e) => (e.target.style.borderColor = "#ddd")}
              />
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 40px 12px 14px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#217E79")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#666",
                    fontSize: 18,
                  }}
                >
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div style={{ marginBottom: 24, textAlign: "right" }}>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Forgot password clicked");
                }}
                style={{
                  fontSize: 13,
                  color: "#217E79",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={busy}
              className="login-submit"
              style={{
                width: "100%",
                padding: "12px 16px",
                background: busy ? "#999" : "#217E79",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                transition: "background 0.2s",
                marginBottom: 16,
              }}
            >
              {busy ? (
                <>
                  <span style={{ display: "inline-block", marginRight: 8 }}>
                    <i className="bi bi-hourglass-split" style={{ animation: "spin 1s linear infinite" }}></i>
                  </span>
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>
          )}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "#ddd" }}></div>
            <div style={{ padding: "0 12px", color: "#999", fontSize: 12, fontWeight: 500 }}>Or</div>
            <div style={{ flex: 1, height: 1, background: "#ddd" }}></div>
          </div>

          {/* Google Login */}
          <button
            type="button"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f5f5")}
          >
            <i className="bi bi-google" style={{ fontSize: 16 }}></i>
            Sign up with Google
          </button>

          {/* Social Media Icons */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            {[
              { key: "facebook", icon: "bi-facebook", color: "#1877f2" },
              { key: "twitter", icon: "bi-twitter", color: "#1da1f2" },
              { key: "linkedin", icon: "bi-linkedin", color: "#0a66c2" },
              { key: "instagram", icon: "bi-instagram", color: "#E1306C" },
              { key: "whatsapp", icon: "bi-whatsapp", color: "#25D366" },
              { key: "youtube", icon: "bi-youtube", color: "#FF0000" },
            ]
              .filter((social) => orgDetails?.socialMedia?.[social.key])
              .map((social) => (
                <a
                  key={social.key}
                  href={orgDetails.socialMedia[social.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `${social.color}20`,
                    color: social.color,
                    textDecoration: "none",
                    transition: "all 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = social.color;
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${social.color}20`;
                    e.currentTarget.style.color = social.color;
                  }}
                >
                  <i className={`bi ${social.icon}`} style={{ fontSize: 16 }}></i>
                </a>
              ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          [data-login-container] {
            flex-direction: column;
          }
          [data-login-left] {
            min-height: 300px;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
