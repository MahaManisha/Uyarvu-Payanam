/**
 * Graduate Practice Page - AI Study Assistant
 * Tab 6 of 9 roadmap tabs
 * Connects message input to Groq AI backend via /api/study-tools/ask-advisor-chat
 */

import React, { useState, useEffect } from "react";
import { Button, Input, Card, Avatar } from "antd";
import { FiChatLeft2, FiStar, FiBook, FiTrendingUp, FiSearch } from "react-icons/fi";
import { useTranslation } from "next-i18next";

const PracticePage = ({ selectedExamId }) => {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your Uyarvu AI Study Assistant. I can help you with:" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  // Available practice modes
  const practiceModes = [
    { key: "guided", label: "Guided Study", description: "Structured learning path with study plan" },
    { key: "doubt", label: "Doubt-Clearing", description: "Ask questions and get detailed explanations" },
    { key: "interview", label: "Interview Simulation", description: "Mock interview practice with technical questions" },
  ];

  // Send message to AI Advisor backend
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/study-tools/ask-advisor-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed, chatHistory: messages }),
      });

      const data = await response.json();

      if (data.success && data.reply) {
        // Add assistant response
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);

        // Log intent and target career for debugging
        console.log("AI Intent:", data.intent);
        console.log("Target Career:", data.targetCareer);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message || "Sorry, I couldn't process that." },
        ]);
      }
    } catch (error) {
      console.error("AI chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Load exam-specific context if an exam is selected
  useEffect(() => {
    if (selectedExamId) {
      // Could fetch exam pattern/syllabus to inform AI responses
      console.log("Exam selected:", selectedExamId);
    }
  }, [selectedExamId]);

  return (
    <Card borderTitle
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FiBook size={18} /> <span>{t("practice_tab_title", "Practice & Assess")}</span>
        </div>
      }
    >
      <div style={{ padding: "20px" }}>
        {/* Practice Modes */}
        <div style={{ marginBottom: "20px" }}>
          <h4>{t("practice_modes", "Practice Modes")}</h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            {practiceModes.map((mode) => (
              <Card
                key={mode.key}
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#f5f7fa",
                }}
                onClick={() => {
                  // Could navigate to specific mode or set state
                  console.log(`Selected: ${mode.label}`);
                }}
              >
                <div
                  style={{ fontSize: "24px", marginBottom: "8px" }}
                >
                  {mode.key === "guided"
                    ? "📋"
                    : mode.key === "doubt"
                    ? "❓"
                    : "🎯"}
                </div>
                <strong>{mode.key}</strong>
                <small>{mode.description}</small>
              </Card>
            ))}
          </div>
        </div>

        {/* Chat Interface */}
        <div
          style={{
            height: "400px",
            overflow: "auto",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "20px",
            background: "#fff",
          }}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                marginBottom: "12px",
                maxWidth: "80%",
                ...msg.role === "user"
                  ? {
                      marginLeft: "auto",
                      background: "#0066ff",
                      color: "white",
                      borderRadius: "12px 12px 0 12px",
                    }
                  : {
                      marginRight: "auto",
                      background: "#e5e5ea",
                      color: "#333",
                      borderRadius: "12px 12px 12px 0",
                    }},
            }
          >
            <Avatar size="style={{ flexShrink: 0, marginRight: "8px" }}>"{msg.role === "user" ? "U" : "AI"}</Avatar>
            <div style={{ flex: 1 }}>{msg.content}</div>
          </div>
        </div>)

        {/* Input Area */}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <Input
            placeholder={t("type_message", "Type a message...")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            style={{ flex: 1, borderRadius: "20px 0 0 20px", border: "1px solid #d9d9d9" }}
            disabledStyle={{ background: "#f0f2f5" }}
          />
          <Button
            type="primary"
            htmlType="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              borderRadius: "0 20px 20px 0",
              border: "none",
              background: "#0066ff",
              color: "white",
              padding: "0 20px",
            }}
          >
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default PracticePage;