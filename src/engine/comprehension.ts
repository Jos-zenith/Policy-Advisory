/**
 * Reality check (FR-5.1, FR-5.2). Three questions whose correct answers come
 * from context (Q1's correct option is the chosen cover amount). A wrong answer
 * shows a plain correction and allows one more try, then the journey carries on
 * with a flag. Never blocks, never scores the person as pass/fail.
 */
import type { EngineConfig, ExplainStep, Category } from "./types";
import { q, step } from "./explain";
import { earlyYearsRange } from "./surrender";

export interface Question {
  id: "q1" | "q2" | "q3";
  text: string;
  options: ExplainStep[];
  correct: number;
  correction: ExplainStep;
  topic: string;
}

export interface ComprehensionContext {
  cover: number;
  category: Category;
}

export function buildQuestions(ctx: ComprehensionContext, c: EngineConfig): Question[] {
  const r = earlyYearsRange(c);
  const isTerm = ctx.category === "TERM";
  return [
    {
      id: "q1",
      topic: "Cover amount paid on death",
      text: `If you died during the term, about how much would your family get from this ${isTerm ? "term plan" : "plan"}?`,
      options: [step("{cover}, the cover amount", { cover: q(ctx.cover, "inr") }), step("The premiums I paid, plus interest"), step("Nothing, unless the policy matures")],
      correct: 0,
      correction: step("Your family would get the cover amount, {cover}. That is the whole point of life cover: the premiums are what it costs, not what is paid out.", { cover: q(ctx.cover, "inr") }),
    },
    {
      id: "q2",
      topic: "Early surrender of savings plans",
      text: "What usually happens if you stop paying a savings plan, like an endowment, in the first few years?",
      options: [step("I get all my money back"), step("I get back much less than I paid"), step("My cover carries on for free")],
      correct: 1,
      correction: step("Early on you usually get back much less than you paid: about {lo} to {hi} in years {from} to {to} under the current rules.", { lo: q(r.minPct, "pct", 0), hi: q(r.maxPct, "pct", 0), from: q(r.from, "number"), to: q(r.to, "number") }),
    },
    {
      id: "q3",
      topic: isTerm ? "Term is protection only" : "This plan mixes protection and savings",
      text: `Is the ${isTerm ? "term plan" : "plan you chose"} protection, savings, or both?`,
      options: [step("Protection only"), step("Savings only"), step("Both")],
      correct: isTerm ? 0 : 2,
      correction: isTerm ? step("A term plan is protection only: it pays if you die during the term and nothing comes back if you don't. That's why it costs the least.") : step("It is both: part of each premium buys cover, the rest goes into savings."),
    },
  ];
}

export type AnswerState = "UNANSWERED" | "RIGHT_FIRST" | "WRONG_RETRY" | "CORRECTED" | "WRONG_TWICE";

export interface QuestionResult {
  firstTry: boolean | null;
  corrected: boolean;
  state: AnswerState;
}

export interface ComprehensionResult {
  q1: QuestionResult;
  q2: QuestionResult;
  q3: QuestionResult;
  /** Questions right first time. */
  score: number;
  answered: number;
  complete: boolean;
  needsFollowUp: boolean;
}

export function questionState(qn: Question, picks: number[] | undefined): QuestionResult {
  if (!picks || picks.length === 0) return { firstTry: null, corrected: false, state: "UNANSWERED" };
  if (picks[0] === qn.correct) return { firstTry: true, corrected: false, state: "RIGHT_FIRST" };
  if (picks.length === 1) return { firstTry: false, corrected: false, state: "WRONG_RETRY" };
  return picks[1] === qn.correct ? { firstTry: false, corrected: true, state: "CORRECTED" } : { firstTry: false, corrected: false, state: "WRONG_TWICE" };
}

export function evaluateComprehension(questions: Question[], answers: Record<string, number[]>): ComprehensionResult {
  const res = Object.fromEntries(questions.map((qn) => [qn.id, questionState(qn, answers[qn.id])])) as Record<"q1" | "q2" | "q3", QuestionResult>;
  const all = Object.values(res);
  const done = (s: QuestionResult) => s.state === "RIGHT_FIRST" || s.state === "CORRECTED" || s.state === "WRONG_TWICE";
  return {
    ...res,
    score: all.filter((s) => s.firstTry === true).length,
    answered: all.filter(done).length,
    complete: all.every(done),
    needsFollowUp: all.some((s) => s.firstTry === false),
  };
}

export function describeResult(qs: Question[], r: ComprehensionResult): string {
  const label: Record<AnswerState, string> = { UNANSWERED: "skipped", RIGHT_FIRST: "right", WRONG_RETRY: "wrong", CORRECTED: "wrong, corrected, right", WRONG_TWICE: "wrong twice, explained" };
  return qs.map((qn, i) => `Q${i + 1} ${label[r[qn.id].state]}`).join(" · ");
}
