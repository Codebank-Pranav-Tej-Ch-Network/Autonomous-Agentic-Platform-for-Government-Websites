import React, { useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";

export default function AuthPage() {
  const [mode, setMode] = useState("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    phone: "",
    password: "",
    dob: "",
    gender: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // ✅ Fixed Signup Function
  async function handleSignup() {
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await axios.post("http://localhost:3000/api/auth/register", {
        fullName: form.fullname,
        email: form.email,
        password: form.password,
        phoneNumber: form.phone,
        dob: form.dob,
        gender: form.gender,
      });

      setMessage({
        text: res.data.message || "✅ Registered successfully!",
        type: "success",
      });
      setMode("login");
    } catch (err) {
      setMessage({
        text:
          err.response?.data?.message ||
          "❌ Registration failed. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  // ✅ Fixed Login Function
  async function handleLogin() {
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await axios.post("http://localhost:3000/api/auth/login", {
        email: form.email,
        password: form.password,
      });

      setMessage({ text: "✅ Logged in successfully!", type: "success" });
      console.log("User:", res.data);
    } catch (err) {
      setMessage({
        text:
          err.response?.data?.message ||
          "❌ Login failed. Check your credentials.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-white/20 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-white"
      >
        <h1 className="text-3xl font-extrabold text-center mb-6 drop-shadow-lg">
          {mode === "signup" ? "Create Account" : "Welcome Back"}
        </h1>

        {message.text && (
          <div
            className={`mb-4 text-center p-3 rounded-lg ${
              message.type === "success"
                ? "bg-green-400/30 border border-green-300 text-green-100"
                : "bg-red-400/30 border border-red-300 text-red-100"
            }`}
          >
            {message.text}
          </div>
        )}

        <form className="space-y-4">
          {mode === "signup" && (
            <>
              <input
                type="text"
                name="fullname"
                value={form.fullname}
                onChange={handleChange}
                placeholder="Full Name"
                className="w-full p-3 rounded-lg bg-white/10 border border-white/30 focus:ring-2 focus:ring-pink-300 outline-none"
              />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email Address"
                className="w-full p-3 rounded-lg bg-white/10 border border-white/30 focus:ring-2 focus:ring-pink-300 outline-none"
              />
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone Number"
                className="w-full p-3 rounded-lg bg-white/10 border border-white/30 focus:ring-2 focus:ring-pink-300 outline-none"
              />
              <input
                type="date"
                name="dob"
                placeholder="Date of Birth"
                value={form.dob}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-white/10 border border-white/30 focus:ring-2 focus:ring-pink-300 outline-none"
              />
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-white/10 border border-white/30 focus:ring-2 focus:ring-pink-300 outline-none"
              >
                <option value="">Select Gender</option>
                <option value="male" className="text-black">
                  Male
                </option>
                <option value="female" className="text-black">
                  Female
                </option>
                <option value="nonbinary" className="text-black">
                  Non-binary
                </option>
              </select>
            </>
          )}

          {mode === "login" && (
            <>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email Address"
                className="w-full p-3 rounded-lg bg-white/10 border border-white/30 focus:ring-2 focus:ring-pink-300 outline-none"
              />
            </>
          )}

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Password"
              className="w-full p-3 rounded-lg bg-white/10 border border-white/30 focus:ring-2 focus:ring-pink-300 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-sm text-white/70"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            type="button"
            onClick={mode === "signup" ? handleSignup : handleLogin}
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-indigo-600 py-3 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "signup"
              ? "Sign Up"
              : "Log In"}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-white/70">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-pink-300 font-semibold hover:underline"
              >
                Log In
              </button>
            </>
          ) : (
            <>
              Don’t have an account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-pink-300 font-semibold hover:underline"
              >
                Sign Up
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
