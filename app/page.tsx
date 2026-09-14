"use client";
// Aoife's Math Game — daily mixed practice: + − × ÷ (20 questions, 5 of each)
import { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import type { RoundLog, RoundQuestionLog } from "@/lib/types";

// Types
type Op = "+" | "-" | "×" | "÷";

interface Question {
  num1: number;
  num2: number;
  op: Op;
  answer: number;
  id: string;
}


type GameState = "loading" | "playing" | "success" | "try-again" | "show-answer" | "ended";

type MessageType = "none" | "try-again" | "correct" | "show-answer";

const TOTAL_QUESTIONS = 20;
const QUESTIONS_PER_OP = 5;
const MAX_INPUT = 13000; // largest possible answer (addition sum cap)
const TIMES_KEY = "aoife-math-times";
const MAX_LOGGED_ROUNDS = 60;

// Displayed minus sign (the id uses "-")
const OP_DISPLAY: Record<Op, string> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };

// ── Question generators ──────────────────────────────────────────────────────

// 4-digit + 4-digit, sum ≤ 13,000 (same as the old aoife-math-game)
const genAddition = (): Question => {
  const num1 = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  const maxNum2 = Math.min(9999, 13000 - num1);
  const num2 = Math.floor(Math.random() * (maxNum2 - 1000 + 1)) + 1000;
  return { num1, num2, op: "+", answer: num1 + num2, id: `${num1}+${num2}` };
};

// num1 1-100, num2 1-num1 (same as long-subtraction-aoife)
const genSubtraction = (): Question => {
  const num1 = Math.floor(Math.random() * 100) + 1; // 1-100
  const num2 = Math.floor(Math.random() * num1) + 1; // 1-num1
  return { num1, num2, op: "-", answer: num1 - num2, id: `${num1}-${num2}` };
};

// double-digit × single-digit: 10-99 × 2-9
const genMultiplication = (): Question => {
  const num1 = Math.floor(Math.random() * 90) + 10; // 10-99
  const num2 = Math.floor(Math.random() * 8) + 2; // 2-9
  return { num1, num2, op: "×", answer: num1 * num2, id: `${num1}×${num2}` };
};

// inverse times-table facts: (divisor × quotient) ÷ divisor, both 2-12
const genDivision = (): Question => {
  const divisor = Math.floor(Math.random() * 11) + 2; // 2-12
  const quotient = Math.floor(Math.random() * 11) + 2; // 2-12
  const dividend = divisor * quotient;
  return { num1: dividend, num2: divisor, op: "÷", answer: quotient, id: `${dividend}÷${divisor}` };
};

const GENERATORS = [genAddition, genSubtraction, genMultiplication, genDivision];

// 5 unique questions per operation, then everything shuffled together
const buildRound = (): Question[] => {
  const round: Question[] = [];
  const usedIds = new Set<string>();
  for (const gen of GENERATORS) {
    let added = 0;
    while (added < QUESTIONS_PER_OP) {
      const q = gen();
      if (!usedIds.has(q.id)) {
        round.push(q);
        usedIds.add(q.id);
        added++;
      }
    }
  }
  // Fisher–Yates shuffle across all 20
  for (let i = round.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [round[i], round[j]] = [round[j], round[i]];
  }
  return round;
};

// ── Silent round-time log (never rendered to Aoife) ──────────────────────────

const loadRoundLogs = (): RoundLog[] => {
  try {
    const stored = localStorage.getItem(TIMES_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Error loading round logs:", e);
  }
  return [];
};

const saveRoundLog = (log: RoundLog) => {
  try {
    const logs = loadRoundLogs();
    logs.push(log);
    localStorage.setItem(TIMES_KEY, JSON.stringify(logs.slice(-MAX_LOGGED_ROUNDS)));
  } catch (e) {
    console.error("Error saving round log:", e);
  }
};

// Parent alert: POST the round to /api/rounds (→ Telegram DM). Fire-and-forget,
// 3 tries with backoff for flaky wifi, never throws, never shown to Aoife.
const postRound = async (log: RoundLog) => {
  const body = JSON.stringify(log);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) return;
    } catch {
      // retry below
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  console.error("Round alert not delivered");
};

const formatClock = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function AoifeMathGame() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("none");
  const [attempt, setAttempt] = useState(1);
  const [showAnswer, setShowAnswer] = useState(false);

  // Silent timing — no timer is ever shown on screen (it distracts her)
  const roundStartRef = useRef<number | null>(null);
  const questionStartRef = useRef<number | null>(null);
  const perQuestionRef = useRef<RoundQuestionLog[]>([]);
  // Once per round: two queued last-question timers must not log or alert the round twice
  const roundFinishedRef = useRef(false);

  // Hidden parent peek: 5 quick taps on the round counter / end-screen emoji
  const [showTimes, setShowTimes] = useState(false);
  const [roundLogs, setRoundLogs] = useState<RoundLog[]>([]);
  const secretTapsRef = useRef<number[]>([]);

  const handleSecretTap = () => {
    const now = Date.now();
    secretTapsRef.current = [...secretTapsRef.current.filter((t) => now - t < 2000), now];
    if (secretTapsRef.current.length >= 5) {
      secretTapsRef.current = [];
      setRoundLogs(loadRoundLogs().slice().reverse());
      setShowTimes(true);
    }
  };

  const initializeGame = useCallback(() => {
    setQuestions(buildRound());
    setCurrentQuestionIndex(0);
    setScore(0);
    setUserAnswer(null);
    setGameState("playing");
    setMessage("");
    setMessageType("none");
    setAttempt(1);
    setShowAnswer(false);
    roundStartRef.current = null;
    questionStartRef.current = null;
    perQuestionRef.current = [];
    roundFinishedRef.current = false;
  }, []);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const currentQuestion = questions[currentQuestionIndex];

  // Clock starts on her first numpad press, not on page load
  const markStarted = () => {
    if (roundStartRef.current === null) {
      // eslint-disable-next-line react-hooks/purity -- only runs from numpad click handlers
      roundStartRef.current = Date.now();
      // eslint-disable-next-line react-hooks/purity -- only runs from numpad click handlers
      questionStartRef.current = Date.now();
    }
  };

  const inputDigit = (num: number) => {
    markStarted();
    const newAnswer = userAnswer === null ? num : userAnswer * 10 + num;
    if (newAnswer <= MAX_INPUT) {
      setUserAnswer(newAnswer);
    }
  };

  const finishRound = (finalScore: number) => {
    if (roundFinishedRef.current) return;
    roundFinishedRef.current = true;
    const totalMs = roundStartRef.current !== null ? Date.now() - roundStartRef.current : 0;
    const log: RoundLog = {
      date: new Date().toISOString(),
      totalMs,
      score: finalScore,
      perQuestion: perQuestionRef.current,
    };
    saveRoundLog(log);
    void postRound(log);
    setGameState("ended");
  };

  const handleAnswer = (answer: number) => {
    if (gameState !== "playing" || !currentQuestion) return;

    const questionMs =
      questionStartRef.current !== null ? Date.now() - questionStartRef.current : 0;
    const isLast = currentQuestionIndex === TOTAL_QUESTIONS - 1;
    const correct = answer === currentQuestion.answer;

    setUserAnswer(answer);

    if (correct) {
      const newScore = score + 1;
      setScore(newScore);
      perQuestionRef.current.push({ id: currentQuestion.id, ms: questionMs, correct: true, tries: attempt });
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#f43f5e", "#a855f7", "#3b82f6", "#fbbf24"],
      });
      setMessage("🎉 Awesome! You got it right!");
      setMessageType("correct");
      setGameState("success");

      setTimeout(() => {
        if (isLast) {
          finishRound(newScore);
        } else {
          questionStartRef.current = Date.now();
          setCurrentQuestionIndex((prev) => prev + 1);
          setUserAnswer(null);
          setGameState("playing");
          setMessage("");
          setMessageType("none");
          setAttempt(1);
        }
      }, 1500);
    } else if (attempt === 1) {
      setMessage("Oops! Let's try one more time! 💪");
      setMessageType("try-again");
      setGameState("try-again");
      setUserAnswer(null);
      setAttempt(2);
      setTimeout(() => {
        setGameState("playing");
        setMessage("");
        setMessageType("none");
      }, 1500);
    } else {
      perQuestionRef.current.push({ id: currentQuestion.id, ms: questionMs, correct: false, tries: 2 });
      setMessage(`The correct answer is ${currentQuestion.answer}!`);
      setMessageType("show-answer");
      setGameState("show-answer");
      setShowAnswer(true);

      setTimeout(() => {
        if (isLast) {
          finishRound(score);
        } else {
          questionStartRef.current = Date.now();
          setCurrentQuestionIndex((prev) => prev + 1);
          setUserAnswer(null);
          setGameState("playing");
          setMessage("");
          setMessageType("none");
          setAttempt(1);
          setShowAnswer(false);
        }
      }, 2500);
    }
  };

  // ── Hidden parent overlay (5 taps) ─────────────────────────────────────────
  const timesOverlay = showTimes && (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
      onClick={() => setShowTimes(false)}
    >
      <div
        className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black text-gray-800">Round Times ⏱</h2>
          <button
            onClick={() => setShowTimes(false)}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {roundLogs.length > 0 ? (
            roundLogs.map((log, i) => (
              <div
                key={i}
                className="flex justify-between items-center bg-pink-50 rounded-xl px-4 py-2 text-sm font-bold"
              >
                <span className="text-gray-500">
                  {new Date(log.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date(log.date).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-blue-500">{formatClock(log.totalMs)}</span>
                <span className="text-pink-600">
                  {log.score}/{TOTAL_QUESTIONS}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">No rounds finished yet</p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">Tap outside to close</p>
      </div>
    </div>
  );

  if (gameState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-3xl font-black text-pink-500">Loading...</div>
      </div>
    );
  }

  if (gameState === "ended") {
    let emoji = "";
    let subtitle = "";
    if (score === TOTAL_QUESTIONS) {
      emoji = "🏆";
      subtitle = "You got every single one right!";
    } else if (score >= 16) {
      emoji = "⭐";
      subtitle = "You're getting really good at this!";
    } else if (score >= 12) {
      emoji = "💜";
      subtitle = "Practice makes perfect!";
    } else {
      emoji = "🌸";
      subtitle = "Keep trying, you're improving!";
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white/90 backdrop-blur-md rounded-[3rem] shadow-[0_20px_60px_rgba(244,63,94,0.15)] p-10 max-w-sm w-full text-center border-4 border-pink-100 animate-bounce-in">
          <div className="text-7xl mb-3 select-none" onClick={handleSecretTap}>
            {emoji}
          </div>
          <p className="text-3xl font-black text-pink-600 mb-1">Great job, Aoife!</p>
          <p className="text-lg text-purple-500 mb-8">{subtitle}</p>
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-6 mb-6 border-2 border-pink-100">
            <p className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-1">
              Score
            </p>
            <p className="text-7xl font-black text-pink-600">
              {score}
              <span className="text-3xl text-purple-400"> / {TOTAL_QUESTIONS}</span>
            </p>
          </div>
          <button
            onClick={initializeGame}
            className="w-full bg-gradient-to-br from-pink-400 to-purple-500 text-white text-2xl font-black py-4 rounded-2xl border-b-8 border-purple-700 shadow-lg hover:-translate-y-1 active:translate-y-1 active:border-b-2 transition-all duration-100"
          >
            Play Again!
          </button>
        </div>
        {timesOverlay}
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center justify-center gap-4 px-8 pt-8 pb-16 touch-manipulation">
      {/* Background blobs */}
      <div className="fixed top-0 left-0 w-72 h-72 bg-pink-300 rounded-full blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-purple-300 rounded-full blur-3xl opacity-20 translate-x-1/3 translate-y-1/3 pointer-events-none" />
      <div className="fixed top-1/2 right-0 w-48 h-48 bg-blue-200 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* ── Progress bar ── */}
      <div className="w-full max-w-2xl flex items-center gap-4">
        <span
          className="text-pink-500 font-black text-lg tabular-nums whitespace-nowrap select-none"
          onClick={handleSecretTap}
        >
          {currentQuestionIndex + 1}
          <span className="text-pink-300"> / {TOTAL_QUESTIONS}</span>
        </span>
        <div className="flex-1 h-4 bg-white/70 rounded-full overflow-hidden shadow-inner border-2 border-pink-100">
          <div
            className="h-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${((currentQuestionIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>
        <span className="text-purple-500 font-black text-lg tabular-nums whitespace-nowrap">
          {score} ⭐
        </span>
      </div>

      {/* ── Equation card ── */}
      <div className="w-full max-w-2xl bg-white/85 backdrop-blur-md rounded-3xl shadow-[0_12px_40px_rgba(244,63,94,0.12)] border-4 border-white px-10 py-5">
        {/* One-line equation */}
        <div className="flex items-center justify-center gap-5 mb-4">
          <span className="text-6xl font-black text-pink-600 tabular-nums tracking-tight drop-shadow-sm">
            {currentQuestion?.num1}
          </span>
          <span className="text-4xl font-black text-blue-400">
            {currentQuestion ? OP_DISPLAY[currentQuestion.op] : ""}
          </span>
          <span className="text-6xl font-black text-purple-600 tabular-nums tracking-tight drop-shadow-sm">
            {currentQuestion?.num2}
          </span>
          <span className="text-4xl font-black text-purple-400">=</span>

          {/* Answer box inline */}
          <div
            className={`flex-1 min-w-[140px] rounded-2xl h-[80px] flex items-center justify-center border-[3px] border-dashed transition-all duration-300 ${
              messageType === "correct"
                ? "bg-green-50  border-green-300"
                : messageType === "try-again"
                  ? "bg-amber-50  border-amber-300"
                  : messageType === "show-answer"
                    ? "bg-purple-50 border-purple-300"
                    : "bg-pink-50 border-pink-200"
            }`}
          >
            <span
              className={`text-5xl font-black leading-none ${
                messageType === "correct"
                  ? "text-green-600"
                  : messageType === "try-again"
                    ? "text-amber-500"
                    : messageType === "show-answer"
                      ? "text-purple-600"
                      : "bg-gradient-to-br from-pink-500 to-purple-600 bg-clip-text text-transparent"
              }`}
            >
              {showAnswer ? currentQuestion?.answer : userAnswer !== null ? userAnswer : "?"}
            </span>
          </div>
        </div>

        {/* Feedback message */}
        {message && (
          <div
            className={`w-full py-2.5 px-5 rounded-xl text-sm font-bold text-center animate-bounce-in ${
              messageType === "correct"
                ? "bg-green-100 text-green-700"
                : messageType === "try-again"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-purple-100 text-purple-700"
            }`}
          >
            {message}
          </div>
        )}
      </div>

      {/* ── Numpad ── */}
      <div className="w-full max-w-2xl flex flex-col gap-4">
        {gameState === "playing" && (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => inputDigit(num)}
                className="bg-white border-b-[6px] border-pink-200 rounded-[2rem] py-5 text-4xl font-black text-pink-500 shadow-lg active:translate-y-[4px] active:border-b-[1px] active:shadow-sm transition-all duration-75 font-bubble select-none"
              >
                {num}
              </button>
            ))}
            {/* Row 4: C, 0, ✔️ */}
            <button
              onClick={() => setUserAnswer(null)}
              className="bg-amber-100 border-b-[6px] border-amber-300 rounded-[2rem] py-5 text-4xl font-black text-amber-600 shadow-lg active:translate-y-[4px] active:border-b-[1px] active:shadow-sm transition-all duration-75 font-bubble select-none"
            >
              C
            </button>
            <button
              onClick={() => inputDigit(0)}
              className="bg-white border-b-[6px] border-pink-200 rounded-[2rem] py-5 text-4xl font-black text-pink-500 shadow-lg active:translate-y-[4px] active:border-b-[1px] active:shadow-md transition-all duration-75 font-bubble select-none"
            >
              0
            </button>
            <button
              onClick={() => {
                if (userAnswer !== null) {
                  handleAnswer(userAnswer);
                }
              }}
              disabled={userAnswer === null}
              className={`border-b-[6px] rounded-[2rem] py-5 text-4xl font-black shadow-lg active:translate-y-[4px] active:border-b-[1px] active:shadow-md transition-all duration-75 font-bubble select-none ${
                userAnswer !== null
                  ? "bg-green-100 border-green-300 text-green-600"
                  : "bg-gray-100 border-gray-300 text-gray-400"
              }`}
            >
              ✔️
            </button>
          </div>
        )}

        {/* Attempt dots */}
        <div className="flex justify-center items-center gap-2">
          {[1, 2].map((i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i <= attempt ? "bg-pink-400" : "bg-pink-200"
              }`}
            />
          ))}
          <span className="text-pink-400 font-bold text-xs uppercase tracking-widest ml-2">
            Try {attempt} of 2
          </span>
        </div>
      </div>

      {timesOverlay}
    </div>
  );
}
