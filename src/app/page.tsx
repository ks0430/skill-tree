import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-blue/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        <h1 className="text-5xl font-bold font-mono mb-4 bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
          SkillForge
        </h1>
        <p className="text-xl text-slate-400 mb-2">
          AI-Powered Game-Style Skill Tree Builder
        </p>
        <p className="text-slate-500 mb-8">
          Tell the AI what you want to learn. Watch your skill tree come to life.
          Track your progress like an RPG.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-lg bg-accent-blue text-white font-medium hover:bg-accent-blue/90 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg glass text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
