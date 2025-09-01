import React, { useState, useEffect, Fragment } from 'react';
import { supabase, missingSupabaseEnv } from './supabaseClient';
import { 
  FaUser, FaComment, FaChartBar, FaSignOutAlt, FaGoogle, 
  FaWallet, FaCreditCard, FaChevronRight, FaRegLightbulb, 
  FaMoneyBillWave, FaPiggyBank, FaBell, FaCog, FaCheckCircle,
  FaRegQuestionCircle, FaChevronDown
} from 'react-icons/fa';
import { HiOutlineArrowSmRight, HiOutlineCash, HiOutlineShieldCheck } from 'react-icons/hi';
import { BeatLoader, PulseLoader } from 'react-spinners';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Dialog, Transition } from '@headlessui/react';
import { Line, Doughnut } from 'react-chartjs-2';
import ReactMarkdown from 'react-markdown';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// ==================== App Component (Main Router) ====================
function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode
  const [pollDebug, setPollDebug] = useState([]);

  // Initialize theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  
  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.log('Safety timeout triggered - forcing loading to false');
        setLoading(false);
      }
    }, 5000); // 5 seconds timeout
    
    return () => clearTimeout(safetyTimeout);
  }, [loading]);

  // Check for auth session and load user profile
  useEffect(() => {
    if (!supabase || !supabase.auth) {
      console.error('Supabase client not initialized properly');
      setLoading(false);
      return;
    }
    
    // Set up auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state changed:', event, !!currentSession);
      setSession(currentSession);
      if (currentSession?.user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();
          if (!error) setProfile(data); else console.error('Error fetching profile:', error);
        } catch (err) {
          console.error('Unexpected error fetching profile:', err);
        }
        try {
          const start = performance.now();
          const { data: probeData, error: probeError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);
          const dur = Math.round(performance.now() - start);
          console.log('[Diagnostics] Profiles probe', { durationMs: dur, probeError, rowCount: probeData?.length });
        } catch (probeEx) {
          console.warn('[Diagnostics] Probe exception', probeEx);
        }
      }
      setLoading(false);
    });

    const fetchInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) { console.error('Error getting session:', error); setLoading(false); return; }
        const initialSession = data.session;
        setSession(initialSession);
        if (initialSession?.user) {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', initialSession.user.id)
              .single();
            if (!profileError) setProfile(profileData); else console.error('Error fetching profile:', profileError);
          } catch (err) {
            console.error('Unexpected error fetching profile:', err);
          }
          try {
            const start = performance.now();
            const { data: probeData, error: probeError } = await supabase
              .from('profiles')
              .select('id')
              .limit(1);
            const dur = Math.round(performance.now() - start);
            console.log('[Diagnostics] (Initial) Profiles probe', { durationMs: dur, probeError, rowCount: probeData?.length });
          } catch (probeEx) {
            console.warn('[Diagnostics] (Initial) Probe exception', probeEx);
          }
        }
      } catch (err) {
        console.error('Unexpected error getting session:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialSession();
    return () => subscription?.unsubscribe();
  }, []);

  // Fallback polling if auth callback didn't emit SIGNED_IN yet
  useEffect(() => {
    if (loading) return; // wait until initial load done
    if (session) return; // already have session
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // ~5s at 250ms
    const poll = async () => {
      attempts++;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setPollDebug(d => [...d, { t: Date.now(), type: 'err', msg: error.message }]);
        } else if (data?.session) {
          if (!cancelled) {
            setSession(data.session);
            setPollDebug(d => [...d, { t: Date.now(), type: 'found', attempts }]);
            return; // stop polling
          }
        } else {
          setPollDebug(d => [...d, { t: Date.now(), type: 'empty', attempts }]);
        }
      } catch (ex) {
        setPollDebug(d => [...d, { t: Date.now(), type: 'ex', msg: ex.message }]);
      }
      if (!cancelled && attempts < maxAttempts && !session) {
        setTimeout(poll, 250);
      } else if (attempts >= maxAttempts) {
        setPollDebug(d => [...d, { t: Date.now(), type: 'timeout' }]);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [loading, session]);

  // Debug logs
  console.log('App state:', { loading, session: !!session, profile: !!profile });
  
  // Show loading indicator
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="mb-4">
            <BeatLoader color="#6366f1" size={15} />
          </div>
          <h2 className="text-xl font-semibold text-slate-200">Loading FinDost</h2>
          <p className="text-slate-400 text-sm mt-2">Your financial journey begins here</p>
        </div>
      </div>
    );
  }

  // Determine which component to render
  if (!session) {
    return (
      <>
        <ToastContainer 
          position="top-right"
          theme="dark"
          autoClose={5000}
        />
        {missingSupabaseEnv && (
          <div className="bg-red-600 text-white text-xs py-2 px-4 text-center">
            Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY then restart dev server.
          </div>
        )}
  <LandingPage pollDebug={pollDebug} />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <ToastContainer 
          position="top-right"
          theme="dark" 
          autoClose={5000}
        />
        <OnboardingFlow user={session.user} setProfile={setProfile} />
      </>
    );
  }

  return (
    <>
      <ToastContainer 
        position="top-right"
        theme="dark"
        autoClose={5000}
      />
      <MainApp 
        session={session} 
        profile={profile}
        setProfile={setProfile}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    </>
  );
}

// ==================== Landing Page Component ====================
function LandingPage({ pollDebug = [] }) {
  const [authDebug, setAuthDebug] = useState({});
  const [showAuthDebug, setShowAuthDebug] = useState(false);
  const handleLogin = async () => {
    try {
      toast.info("Connecting to Google...");
      const before = Date.now();
      console.log('[Auth] Initiating Google OAuth', { redirectTo: window.location.origin });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          // Force fresh consent to avoid stale state during debugging
          queryParams: { prompt: 'consent' }
        }
      });
      
      if (error) {
        console.error('Error logging in:', error);
        toast.error('Error logging in. Please try again.');
        setAuthDebug(d => ({ ...d, lastAttempt: { ok: false, error: error.message, at: new Date().toISOString(), elapsedMs: Date.now()-before } }));
      } else {
        setAuthDebug(d => ({ ...d, lastAttempt: { ok: true, at: new Date().toISOString(), elapsedMs: Date.now()-before } }));
      }
    } catch (error) {
      console.error('Unexpected error during login:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setAuthDebug(d => ({ ...d, exception: { message: error.message, stack: error.stack } }));
    }
  };

  const probeSession = async () => {
    const t0 = performance.now();
    const { data: sData, error: sErr } = await supabase.auth.getSession();
    const { data: uData, error: uErr } = await supabase.auth.getUser();
    const dur = Math.round(performance.now() - t0);
    const info = { session: !!sData?.session, user: !!uData?.user, sErr: sErr?.message, uErr: uErr?.message, durMs: dur, rawUser: uData?.user };
    console.log('[Auth] Manual session probe', info);
    setAuthDebug(d => ({ ...d, manualProbe: info }));
    toast[sData?.session ? 'success' : 'warning'](sData?.session ? 'Session present' : 'No session yet');
  };

  return (
    <div className="bg-slate-900 min-h-screen text-white">
      {/* Header/Nav */}
      <header className="py-6 px-4 md:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <div className="bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3">
              <FaPiggyBank className="text-white text-lg" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              FinDost
            </h1>
          </div>
          <button 
            onClick={handleLogin}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg text-sm font-medium transition-all flex items-center shadow-lg"
          >
            <FaGoogle className="mr-2" /> Sign In with Google
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="md:w-1/2 mb-10 md:mb-0 md:pr-10">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-white">Stop Worrying About Money,</span>
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent"> Start Living Your Life</span>
            </h2>
            <p className="text-slate-300 text-lg md:text-xl mb-8 leading-relaxed">
              FinDost is your AI-powered financial coach that helps young Indians manage money with confidence, 
              without the jargon or judgment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleLogin}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-medium 
                transition-all flex items-center justify-center"
              >
                <FaGoogle className="mr-2" /> Get Started for Free
              </button>
              <button className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl text-lg font-medium 
                transition-all flex items-center justify-center">
                <FaRegQuestionCircle className="mr-2" /> Learn More
              </button>
            </div>
            <div className="mt-8 flex items-center text-slate-400 text-sm">
              <FaCheckCircle className="text-indigo-500 mr-2" />
              No credit card required
              <span className="mx-3">•</span>
              <FaCheckCircle className="text-indigo-500 mr-2" />
              Free forever
            </div>
            <div className="mt-6 text-xs text-slate-500 space-x-4 flex flex-wrap items-center">
              <button onClick={probeSession} className="underline hover:text-indigo-400">Probe Session</button>
              <button onClick={() => setShowAuthDebug(v=>!v)} className="underline hover:text-indigo-400">{showAuthDebug ? 'Hide' : 'Show'} Auth Debug</button>
            </div>
            {showAuthDebug && (
              <div className="mt-3 space-y-3">
                <pre className="p-3 bg-slate-800/70 border border-slate-700 rounded text-[10px] max-h-56 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(authDebug, null, 2)}</pre>
                {pollDebug.length > 0 && (
                  <pre className="p-3 bg-slate-800/70 border border-slate-700 rounded text-[10px] max-h-40 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(pollDebug.slice(-40), null, 2)}</pre>
                )}
              </div>
            )}
          </div>
          <div className="md:w-1/2 relative">
            <div className="bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-2xl p-1">
              <div className="bg-slate-900 rounded-xl overflow-hidden">
                <div className="w-full h-[300px] flex items-center justify-center text-lg bg-slate-800 text-slate-300">
                  <div className="space-y-4 p-6">
                    <div className="flex items-center mb-6">
                      <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center mr-4">
                        <FaPiggyBank className="text-white" />
                      </div>
                      <div className="font-bold text-xl text-white">FinDost Dashboard</div>
                    </div>
                    <div className="h-4 bg-slate-700 rounded-full w-3/4"></div>
                    <div className="h-4 bg-slate-700 rounded-full w-1/2"></div>
                    <div className="flex mt-8 space-x-4">
                      <div className="h-20 w-24 bg-slate-700 rounded-lg"></div>
                      <div className="h-20 w-24 bg-slate-700 rounded-lg"></div>
                      <div className="h-20 w-24 bg-slate-700 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="absolute -top-6 -right-6 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 shadow-lg">
              <div className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-white font-medium">AI-Powered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div className="mt-16 text-center">
          <p className="text-slate-400 mb-6">Trusted by thousands of young professionals across India</p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="h-12 px-6 bg-slate-800 rounded-lg flex items-center font-bold text-indigo-400">ICICI</div>
            <div className="h-12 px-6 bg-slate-800 rounded-lg flex items-center font-bold text-indigo-400">HDFC</div>
            <div className="h-12 px-6 bg-slate-800 rounded-lg flex items-center font-bold text-indigo-400">SBI</div>
            <div className="h-12 px-6 bg-slate-800 rounded-lg flex items-center font-bold text-indigo-400">AXIS</div>
            <div className="h-12 flex items-center">HDFC</div>
            <div className="h-12 flex items-center">SBI</div>
            <div className="h-12 flex items-center">AXIS</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 md:px-8 bg-slate-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Young Professionals Choose FinDost</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 transform transition-all hover:scale-105 hover:shadow-xl">
              <div className="bg-indigo-900/50 p-3 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <FaComment className="text-indigo-400 text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Personalized AI Coaching</h3>
              <p className="text-slate-300">Get financial advice tailored to your unique situation, goals, and challenges. No generic tips.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 transform transition-all hover:scale-105 hover:shadow-xl">
              <div className="bg-indigo-900/50 p-3 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <FaChartBar className="text-indigo-400 text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Smart Goal Tracking</h3>
              <p className="text-slate-300">Set meaningful financial goals and track your progress with intuitive visualizations.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 transform transition-all hover:scale-105 hover:shadow-xl">
              <div className="bg-indigo-900/50 p-3 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <FaMoneyBillWave className="text-indigo-400 text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Jargon-Free Advice</h3>
              <p className="text-slate-300">Understand complex financial concepts with simple explanations that actually make sense.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 md:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2">What Our Users Say</h2>
          <p className="text-slate-400 text-center mb-12">Join thousands of satisfied FinDost users</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-xl border border-slate-700">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold mr-4">A</div>
                <div>
                  <h4 className="font-medium">Aditya S.</h4>
                  <p className="text-slate-400 text-sm">Software Engineer</p>
                </div>
              </div>
              <p className="text-slate-300">"FinDost helped me create a savings plan that actually works for my lifestyle. I've saved ₹1.2 lakhs in just 6 months!"</p>
            </div>
            
            {/* Testimonial 2 */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-xl border border-slate-700">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold mr-4">P</div>
                <div>
                  <h4 className="font-medium">Priya M.</h4>
                  <p className="text-slate-400 text-sm">Marketing Manager</p>
                </div>
              </div>
              <p className="text-slate-300">"The AI coach helped me understand investing without all the confusing terms. I finally feel in control of my financial future."</p>
            </div>
            
            {/* Testimonial 3 */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-xl border border-slate-700">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold mr-4">R</div>
                <div>
                  <h4 className="font-medium">Rahul K.</h4>
                  <p className="text-slate-400 text-sm">Freelance Designer</p>
                </div>
              </div>
              <p className="text-slate-300">"As a freelancer with irregular income, FinDost has been a game-changer for managing my finances and planning for the future."</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 md:px-8 bg-gradient-to-br from-indigo-900 to-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Financial Future?</h2>
          <p className="text-xl text-slate-300 mb-8">Join thousands of young Indians who are taking control of their finances with FinDost's AI coach.</p>
          <button 
            onClick={handleLogin}
            className="bg-white hover:bg-slate-100 text-indigo-700 px-8 py-4 rounded-xl text-lg font-medium 
            transition-all flex items-center justify-center mx-auto"
          >
            <FaGoogle className="mr-2" /> Get Started for Free
          </button>
          <p className="mt-6 text-slate-300 text-sm">No credit card required. Cancel anytime.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 md:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">
                <FaPiggyBank className="text-white text-sm" />
              </div>
              <h2 className="text-xl font-bold">FinDost</h2>
            </div>
            <div className="flex space-x-6 text-slate-400">
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">Privacy</a>
              <a href="#" className="hover:text-white">Contact</a>
            </div>
          </div>
          <div className="mt-8 text-center text-slate-500 text-sm">
            © 2025 FinDost. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ==================== Enhanced Multi-Step Onboarding Flow ====================
function OnboardingFlow({ user, setProfile }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Information
    full_name: '',
    age: '',
    gender: '',
    profession: '',
    
    // Financial Information
    monthly_salary_inr: '',
    employment_type: '', // "Full-time", "Part-time", "Freelance", "Business Owner", "Student", "Unemployed"
  monthly_expenses: '',
    
    // Financial Goals
    financial_goals: [], // Multiple selection: "Emergency Fund", "Retirement", "Home Purchase", "Education", "Travel", "Other"
    risk_tolerance: '', // "Conservative", "Moderate", "Aggressive"
    investment_experience: '', // "None", "Beginner", "Intermediate", "Advanced"
    
    // Debts and Liabilities
    has_loans: false,
    loan_types: [], // Multiple selection: "Student Loan", "Home Loan", "Car Loan", "Personal Loan", "Credit Card Debt"
    monthly_loan_payments: '',
    
    // Additional preferences
    communication_preference: 'Casual', // "Casual", "Formal"
    notification_frequency: 'Weekly', // "Daily", "Weekly", "Monthly"
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebug, setShowDebug] = useState(false);
  
  // Options for dropdown selects
  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Non-binary', label: 'Non-binary' },
    { value: 'Prefer not to say', label: 'Prefer not to say' }
  ];
  
  const employmentTypeOptions = [
    { value: 'Full-time', label: 'Full-time' },
    { value: 'Part-time', label: 'Part-time' },
    { value: 'Freelance', label: 'Freelance' },
    { value: 'Business Owner', label: 'Business Owner' },
    { value: 'Student', label: 'Student' },
    { value: 'Unemployed', label: 'Unemployed' }
  ];
  
  const financialGoalOptions = [
    { value: 'Emergency Fund', label: 'Build Emergency Fund' },
    { value: 'Retirement', label: 'Save for Retirement' },
    { value: 'Home Purchase', label: 'Purchase a Home' },
    { value: 'Education', label: 'Education Savings' },
    { value: 'Travel', label: 'Travel Fund' },
    { value: 'Debt Repayment', label: 'Pay off Debts' },
    { value: 'Wealth Building', label: 'Build Wealth' },
    { value: 'Other', label: 'Other Goals' }
  ];
  
  const riskToleranceOptions = [
    { value: 'Conservative', label: 'Conservative - I prefer stability even if returns are lower' },
    { value: 'Moderate', label: 'Moderate - I can accept some risk for better returns' },
    { value: 'Aggressive', label: 'Aggressive - I am comfortable with higher risk for potentially higher returns' }
  ];
  
  const investmentExperienceOptions = [
    { value: 'None', label: 'None - I am just getting started' },
    { value: 'Beginner', label: 'Beginner - I know the basics' },
    { value: 'Intermediate', label: 'Intermediate - I have been investing for a while' },
    { value: 'Advanced', label: 'Advanced - I am very experienced with investing' }
  ];
  
  const loanTypeOptions = [
    { value: 'Student Loan', label: 'Student Loan' },
    { value: 'Home Loan', label: 'Home Loan' },
    { value: 'Car Loan', label: 'Car Loan' },
    { value: 'Personal Loan', label: 'Personal Loan' },
    { value: 'Credit Card Debt', label: 'Credit Card Debt' }
  ];
  
  const communicationPreferenceOptions = [
    { value: 'Casual', label: 'Casual - Friendly and conversational' },
    { value: 'Formal', label: 'Formal - Professional and straightforward' }
  ];
  
  const notificationFrequencyOptions = [
    { value: 'Daily', label: 'Daily updates' },
    { value: 'Weekly', label: 'Weekly summaries' },
    { value: 'Monthly', label: 'Monthly reports' }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleSelectChange = (selectedOption, name) => {
    setFormData({ ...formData, [name]: selectedOption.value });
  };
  
  const handleMultiSelectChange = (selectedOptions, name) => {
    const values = selectedOptions.map(option => option.value);
    setFormData({ ...formData, [name]: values });
  };

  const validateStep = (currentStep) => {
    switch(currentStep) {
      case 1:
        return formData.full_name && formData.age && formData.gender && formData.profession;
      case 2:
  return formData.monthly_salary_inr && formData.employment_type && formData.monthly_expenses;
      case 3:
        return formData.financial_goals.length > 0 && formData.risk_tolerance && formData.investment_experience;
      case 4:
        // If has loans is true, validate loan types and payments
        return !formData.has_loans || (formData.has_loans && formData.loan_types.length > 0 && formData.monthly_loan_payments);
      default:
        return true;
    }
  };
  
  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      toast.error("Please complete all required fields before continuing");
    }
  };
  
  const handlePrevStep = () => {
    setStep(step - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // prevent double submit
    setLoading(true);
    setError(null);
    setSubmitError(null);

    // Safety timeout in case request hangs
    let didTimeout = false;
    const safetyTimer = setTimeout(() => {
      didTimeout = true;
      console.warn('[Onboarding] Safety timeout triggered');
      setSubmitError('Network slow. Using local profile so you can continue.');
      // Create a local fallback profile so user can proceed
      const fallback = buildProfileData();
      fallback.__fallback = true;
      localStorage.setItem('findost_profile_fallback', JSON.stringify(fallback));
      setProfile(fallback);
      setLoading(false);
    }, 12000);

    try {
      const profileData = buildProfileData();
      console.log('[Onboarding] Submitting profileData', profileData);
      setDebugInfo(d => ({ ...d, submitting: profileData }));

      // Adaptive upsert: attempt removal of missing columns iteratively
      let attemptPayload = { ...profileData };
      let data = null;
      let supabaseError = null;
      const removedColumns = [];
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: d, error: e } = await supabase
          .from('profiles')
          .upsert(attemptPayload, { returning: 'representation' })
          .select()
          .single();
        if (!e) { data = d; supabaseError = null; break; }
        supabaseError = e;
        const match = /could not find the '([^']+)' column/i.exec(e.message || '');
        if (match) {
          const missing = match[1];
          if (missing in attemptPayload) {
            console.warn('[Onboarding] Removing missing column', missing, 'and retrying');
            removedColumns.push(missing);
            delete attemptPayload[missing];
            continue;
          }
        }
        // if different kind of error, break
        break;
      }
      if (removedColumns.length) {
        // Map for known column types
        const columnTypeMap = {
          full_name: 'text',
          age: 'int',
          gender: 'text',
            profession: 'text',
          monthly_salary_inr: 'int',
          employment_type: 'text',
          monthly_expenses: 'int',
          financial_goals: 'text[]',
          risk_tolerance: 'text',
          investment_experience: 'text',
          has_loans: 'boolean',
          loan_types: 'text[]',
          monthly_loan_payments: 'int',
          communication_preference: 'text',
          notification_frequency: 'text',
          created_locally_at: 'timestamptz'
        };
        const ddl = removedColumns.map(col => {
          const sqlType = columnTypeMap[col] || 'text';
          return `alter table public.profiles add column if not exists ${col} ${sqlType};`;
        }).join('\n');
        const sqlSnippet = `-- Run this in Supabase SQL editor to add missing columns\n${ddl}`;
        setDebugInfo(d => ({ ...d, removedColumns, generatedColumnSql: sqlSnippet }));
      }
      if (supabaseError) {
        console.error('[Onboarding] Supabase upsert error', supabaseError);
        setDebugInfo(d => ({ ...d, supabaseError }));
        throw supabaseError;
      }

      console.log('[Onboarding] Profile upsert success', data);
      setDebugInfo(d => ({ ...d, success: data }));

      // Post-insert verification: ensure row truly exists (guards against silent failures)
      let verified = false;
      try {
        const { data: verifyRow, error: verifyError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', profileData.id)
          .maybeSingle();
        if (verifyError) {
          console.warn('[Onboarding] Verify fetch error', verifyError);
          setDebugInfo(d => ({ ...d, verifyError }));
        }
        verified = !!verifyRow?.id;
        setDebugInfo(d => ({ ...d, verifyCheck: { verified, verifyRow, at: new Date().toISOString() } }));
      } catch (vex) {
        console.warn('[Onboarding] Verification exception', vex);
        setDebugInfo(d => ({ ...d, verifyException: { message: vex.message } }));
      }
      if (!data || !data.id || !verified) {
        const msg = 'Profile not persisted (verification failed). Check RLS policies and table schema.';
        console.error('[Onboarding] ' + msg, { data, verified });
        toast.error(msg);
        throw new Error(msg);
      }

      // Show success message
      toast.success("Profile successfully created!");
      
      // Update profile state
      setProfile(data);

    } catch (err) {
      console.error('Error submitting profile:', err);
      // Build detailed diagnostic
      const diag = {
        message: err.message,
        name: err.name,
        code: err.code,
        details: err.details,
        hint: err.hint,
        status: err.status,
        time: new Date().toISOString()
      };
      setDebugInfo(d => ({ ...d, submitError: diag }));
      // Human friendly mapping
      const interpret = () => {
        if (!err) return 'Unknown error';
        if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
          return 'Profiles table missing. Run the provided SQL to create table & policies.';
        }
        if (err.message?.toLowerCase().includes('permission') || err.code === '42501' || err.code === 'PGRST301') {
          return 'Permission denied (RLS). Add insert/select/update policies for authenticated users where auth.uid() = id.';
        }
        if (err.message?.toLowerCase().includes('duplicate key')) {
          return 'Row already exists but upsert failed. Check primary key definition (id uuid references auth.users(id)).';
        }
        return err.message || 'Unexpected error';
      };
      const friendly = interpret();
      setError(friendly);
      setSubmitError(friendly);
      toast.error('Error saving your profile: ' + friendly);
      // If we already timed out we already set fallback
      if (!didTimeout) {
        // Offer fallback after error
        const fallback = buildProfileData();
        fallback.__fallback = true;
        localStorage.setItem('findost_profile_fallback', JSON.stringify(fallback));
        setDebugInfo(d => ({ ...d, fallback }));
        setProfile(fallback);
      }
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  };

  // Helper to build profile object consistently
  const buildProfileData = () => ({
    id: user.id,
    full_name: formData.full_name,
    age: parseInt(formData.age),
    gender: formData.gender,
    profession: formData.profession,
    monthly_salary_inr: parseInt(formData.monthly_salary_inr) || 0,
    employment_type: formData.employment_type,
  monthly_expenses: parseInt(formData.monthly_expenses) || 0,
    financial_goals: formData.financial_goals,
    risk_tolerance: formData.risk_tolerance,
    investment_experience: formData.investment_experience,
    has_loans: formData.has_loans,
    loan_types: formData.loan_types,
    monthly_loan_payments: parseInt(formData.monthly_loan_payments) || 0,
    communication_preference: formData.communication_preference,
    notification_frequency: formData.notification_frequency,
    created_locally_at: new Date().toISOString()
  });
  
  // Custom styles for react-select with simplified styling that works in all browsers
  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: '#1e293b',
      borderColor: state.isFocused ? '#6366f1' : '#334155',
      borderRadius: '0.5rem',
      padding: '2px',
      boxShadow: state.isFocused ? '0 0 0 2px #4f46e5' : 'none',
      color: 'white',
      '&:hover': {
        borderColor: '#6366f1'
      }
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '0.5rem',
      overflow: 'hidden'
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#334155' : '#1e293b',
      color: 'white',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: state.isSelected ? '#4f46e5' : '#334155'
      }
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'white'
    }),
    input: (provided) => ({
      ...provided,
      color: 'white'
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#94a3b8'
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: '#4f46e5',
      borderRadius: '0.25rem'
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: 'white',
      fontWeight: '500'
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: 'white',
      ':hover': {
        backgroundColor: '#4338ca',
        color: 'white',
      },
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: '#94a3b8',
      '&:hover': {
        color: 'white'
      }
    }),
    clearIndicator: (provided) => ({
      ...provided,
      color: '#94a3b8',
      '&:hover': {
        color: 'white'
      }
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#64748b'
    }),
    input: (provided) => ({
      ...provided,
      color: '#f8fafc'
    })
  };
  
  // Progress bar calculation
  const progressPercentage = (step / 5) * 100;
  
  // Get title based on current step
  const getStepTitle = () => {
    switch(step) {
      case 1: return "Personal Information";
      case 2: return "Financial Status";
      case 3: return "Financial Goals";
      case 4: return "Debts & Liabilities";
      case 5: return "Preferences";
      default: return "Complete Your Profile";
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header with logo */}
      <header className="py-6 px-4 border-b border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center">
          <div className="bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3">
            <FaPiggyBank className="text-white text-lg" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            FinDost
          </h1>
        </div>
      </header>
      
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <h2 className="text-2xl font-bold">{getStepTitle()}</h2>
            <span className="text-slate-400">Step {step} of 5</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}
        
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <form onSubmit={step === 5 ? handleSubmit : (e) => e.preventDefault()}>
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="full_name" className="block text-slate-200 font-medium mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="age" className="block text-slate-200 font-medium mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    id="age"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    placeholder="Enter your age"
                    required
                    min="18"
                    max="100"
                  />
                </div>
                
                <div>
                  <label htmlFor="gender" className="block text-slate-200 font-medium mb-2">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    required
                  >
                    <option value="" disabled>Select your gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="profession" className="block text-slate-200 font-medium mb-2">
                    Profession
                  </label>
                  <input
                    type="text"
                    id="profession"
                    name="profession"
                    value={formData.profession}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    placeholder="Enter your profession"
                    required
                  />
                </div>
              </div>
            )}
            
            {/* Step 2: Financial Information */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="employment_type" className="block text-slate-200 font-medium mb-2">
                    Employment Type
                  </label>
                  <select
                    id="employment_type"
                    name="employment_type"
                    value={formData.employment_type}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    required
                  >
                    <option value="" disabled>Select your employment type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Business Owner">Business Owner</option>
                    <option value="Student">Student</option>
                    <option value="Unemployed">Unemployed</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="monthly_salary_inr" className="block text-slate-200 font-medium mb-2">
                    Monthly Income (₹)
                  </label>
                  <input
                    type="number"
                    id="monthly_salary_inr"
                    name="monthly_salary_inr"
                    value={formData.monthly_salary_inr}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    placeholder="Enter your monthly income"
                    required
                    min="0"
                  />
                  <p className="text-xs text-slate-400 mt-1">Approximate is fine. This helps us tailor advice to your income level.</p>
                </div>
                
                <div>
                  <label htmlFor="monthly_expenses" className="block text-slate-200 font-medium mb-2">
                    Average Monthly Expenses (₹)
                  </label>
                  <input
                    type="number"
                    id="monthly_expenses"
                    name="monthly_expenses"
                    value={formData.monthly_expenses}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    placeholder="Enter your monthly expenses"
                    required
                    min="0"
                  />
                </div>
                
                <div className="bg-indigo-900/30 p-4 rounded-lg border border-indigo-800/50">
                  <div className="flex items-start">
                    <div className="mr-3 text-indigo-400">
                      <FaRegLightbulb size={20} />
                    </div>
                    <p className="text-sm text-slate-300">
                      Your savings rate is a key indicator of financial health. Aim to save at least 20% of your income for long-term goals.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 3: Financial Goals */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-200 font-medium mb-2">
                    What are your financial goals? (Select all that apply)
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id="goal-emergency" 
                        name="financial_goals" 
                        value="Emergency Fund"
                        onChange={(e) => {
                          const value = e.target.value;
                          const isChecked = e.target.checked;
                          setFormData(prev => {
                            const newGoals = isChecked 
                              ? [...(prev.financial_goals || []), value]
                              : (prev.financial_goals || []).filter(g => g !== value);
                            return {...prev, financial_goals: newGoals};
                          });
                        }}
                        checked={formData.financial_goals?.includes("Emergency Fund")}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                      />
                      <label htmlFor="goal-emergency" className="ml-2 text-slate-200">Build Emergency Fund</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id="goal-retirement" 
                        name="financial_goals" 
                        value="Retirement"
                        onChange={(e) => {
                          const value = e.target.value;
                          const isChecked = e.target.checked;
                          setFormData(prev => {
                            const newGoals = isChecked 
                              ? [...(prev.financial_goals || []), value]
                              : (prev.financial_goals || []).filter(g => g !== value);
                            return {...prev, financial_goals: newGoals};
                          });
                        }}
                        checked={formData.financial_goals?.includes("Retirement")}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                      />
                      <label htmlFor="goal-retirement" className="ml-2 text-slate-200">Save for Retirement</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id="goal-home" 
                        name="financial_goals" 
                        value="Home Purchase"
                        onChange={(e) => {
                          const value = e.target.value;
                          const isChecked = e.target.checked;
                          setFormData(prev => {
                            const newGoals = isChecked 
                              ? [...(prev.financial_goals || []), value]
                              : (prev.financial_goals || []).filter(g => g !== value);
                            return {...prev, financial_goals: newGoals};
                          });
                        }}
                        checked={formData.financial_goals?.includes("Home Purchase")}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                      />
                      <label htmlFor="goal-home" className="ml-2 text-slate-200">Purchase a Home</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id="goal-education" 
                        name="financial_goals" 
                        value="Education"
                        onChange={(e) => {
                          const value = e.target.value;
                          const isChecked = e.target.checked;
                          setFormData(prev => {
                            const newGoals = isChecked 
                              ? [...(prev.financial_goals || []), value]
                              : (prev.financial_goals || []).filter(g => g !== value);
                            return {...prev, financial_goals: newGoals};
                          });
                        }}
                        checked={formData.financial_goals?.includes("Education")}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                      />
                      <label htmlFor="goal-education" className="ml-2 text-slate-200">Education Savings</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id="goal-other" 
                        name="financial_goals" 
                        value="Other"
                        onChange={(e) => {
                          const value = e.target.value;
                          const isChecked = e.target.checked;
                          setFormData(prev => {
                            const newGoals = isChecked 
                              ? [...(prev.financial_goals || []), value]
                              : (prev.financial_goals || []).filter(g => g !== value);
                            return {...prev, financial_goals: newGoals};
                          });
                        }}
                        checked={formData.financial_goals?.includes("Other")}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                      />
                      <label htmlFor="goal-other" className="ml-2 text-slate-200">Other Goals</label>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-slate-200 font-medium mb-2">
                    What is your risk tolerance for investments?
                  </label>
                  <select
                    id="risk_tolerance"
                    name="risk_tolerance"
                    value={formData.risk_tolerance}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    required
                  >
                    <option value="" disabled>Select your risk tolerance</option>
                    <option value="Conservative">Conservative - I prefer stability even if returns are lower</option>
                    <option value="Moderate">Moderate - I can accept some risk for better returns</option>
                    <option value="Aggressive">Aggressive - I am comfortable with higher risk for potentially higher returns</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-slate-200 font-medium mb-2">
                    How would you describe your investment experience?
                  </label>
                  <select
                    id="investment_experience"
                    name="investment_experience"
                    value={formData.investment_experience}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    required
                  >
                    <option value="" disabled>Select your investment experience</option>
                    <option value="None">None - I am just getting started</option>
                    <option value="Beginner">Beginner - I know the basics</option>
                    <option value="Intermediate">Intermediate - I have been investing for a while</option>
                    <option value="Advanced">Advanced - I am very experienced with investing</option>
                  </select>
                </div>
                
                <div className="bg-indigo-900/30 p-4 rounded-lg border border-indigo-800/50">
                  <div className="flex items-start">
                    <div className="mr-3 text-indigo-400">
                      <FaRegLightbulb size={20} />
                    </div>
                    <p className="text-sm text-slate-300">
                      Your risk tolerance and investment experience help us tailor our advice to match your comfort level and knowledge.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 4: Debts and Liabilities */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="has_loans"
                      name="has_loans"
                      checked={formData.has_loans}
                      onChange={handleChange}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                    />
                    <label htmlFor="has_loans" className="ml-2 text-slate-200 font-medium">
                      I have loans or other debts
                    </label>
                  </div>
                  
                  {formData.has_loans && (
                    <>
                      <div className="mt-4">
                        <label className="block text-slate-200 font-medium mb-2">
                          What types of loans do you have? (Select all that apply)
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              id="loan-student" 
                              name="loan_types" 
                              value="Student Loan"
                              onChange={(e) => {
                                const value = e.target.value;
                                const isChecked = e.target.checked;
                                setFormData(prev => {
                                  const newLoans = isChecked 
                                    ? [...(prev.loan_types || []), value]
                                    : (prev.loan_types || []).filter(l => l !== value);
                                  return {...prev, loan_types: newLoans};
                                });
                              }}
                              checked={formData.loan_types?.includes("Student Loan")}
                              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="loan-student" className="ml-2 text-slate-200">Student Loan</label>
                          </div>
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              id="loan-home" 
                              name="loan_types" 
                              value="Home Loan"
                              onChange={(e) => {
                                const value = e.target.value;
                                const isChecked = e.target.checked;
                                setFormData(prev => {
                                  const newLoans = isChecked 
                                    ? [...(prev.loan_types || []), value]
                                    : (prev.loan_types || []).filter(l => l !== value);
                                  return {...prev, loan_types: newLoans};
                                });
                              }}
                              checked={formData.loan_types?.includes("Home Loan")}
                              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="loan-home" className="ml-2 text-slate-200">Home Loan</label>
                          </div>
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              id="loan-car" 
                              name="loan_types" 
                              value="Car Loan"
                              onChange={(e) => {
                                const value = e.target.value;
                                const isChecked = e.target.checked;
                                setFormData(prev => {
                                  const newLoans = isChecked 
                                    ? [...(prev.loan_types || []), value]
                                    : (prev.loan_types || []).filter(l => l !== value);
                                  return {...prev, loan_types: newLoans};
                                });
                              }}
                              checked={formData.loan_types?.includes("Car Loan")}
                              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="loan-car" className="ml-2 text-slate-200">Car Loan</label>
                          </div>
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              id="loan-personal" 
                              name="loan_types" 
                              value="Personal Loan"
                              onChange={(e) => {
                                const value = e.target.value;
                                const isChecked = e.target.checked;
                                setFormData(prev => {
                                  const newLoans = isChecked 
                                    ? [...(prev.loan_types || []), value]
                                    : (prev.loan_types || []).filter(l => l !== value);
                                  return {...prev, loan_types: newLoans};
                                });
                              }}
                              checked={formData.loan_types?.includes("Personal Loan")}
                              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="loan-personal" className="ml-2 text-slate-200">Personal Loan</label>
                          </div>
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              id="loan-credit" 
                              name="loan_types" 
                              value="Credit Card Debt"
                              onChange={(e) => {
                                const value = e.target.value;
                                const isChecked = e.target.checked;
                                setFormData(prev => {
                                  const newLoans = isChecked 
                                    ? [...(prev.loan_types || []), value]
                                    : (prev.loan_types || []).filter(l => l !== value);
                                  return {...prev, loan_types: newLoans};
                                });
                              }}
                              checked={formData.loan_types?.includes("Credit Card Debt")}
                              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="loan-credit" className="ml-2 text-slate-200">Credit Card Debt</label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <label htmlFor="monthly_loan_payments" className="block text-slate-200 font-medium mb-2">
                          Total Monthly Loan Payments (₹)
                        </label>
                        <input
                          type="number"
                          id="monthly_loan_payments"
                          name="monthly_loan_payments"
                          value={formData.monthly_loan_payments}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                          placeholder="Enter your monthly loan payments"
                          min="0"
                        />
                      </div>
                    </>
                  )}
                </div>
                
                {formData.has_loans && (
                  <div className="bg-amber-900/30 p-4 rounded-lg border border-amber-800/50">
                    <div className="flex items-start">
                      <div className="mr-3 text-amber-400">
                        <FaRegLightbulb size={20} />
                      </div>
                      <p className="text-sm text-slate-300">
                        Understanding your debt obligations helps us provide balanced advice that considers debt repayment alongside savings and investments.
                      </p>
                    </div>
                  </div>
                )}
                
                {!formData.has_loans && (
                  <div className="bg-green-900/30 p-4 rounded-lg border border-green-800/50">
                    <div className="flex items-start">
                      <div className="mr-3 text-green-400">
                        <FaCheckCircle size={20} />
                      </div>
                      <p className="text-sm text-slate-300">
                        Being debt-free gives you more flexibility with your financial planning. We'll focus on helping you grow your wealth and protect your financial future.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 5: Preferences */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-200 font-medium mb-2">
                    How would you like FinDost to communicate with you?
                  </label>
                  <select
                    id="communication_preference"
                    name="communication_preference"
                    value={formData.communication_preference}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    required
                  >
                    <option value="Casual">Casual - Friendly and conversational</option>
                    <option value="Formal">Formal - Professional and straightforward</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-slate-200 font-medium mb-2">
                    How often would you like to receive notifications?
                  </label>
                  <select
                    id="notification_frequency"
                    name="notification_frequency"
                    value={formData.notification_frequency}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-100"
                    required
                  >
                    <option value="Daily">Daily updates</option>
                    <option value="Weekly">Weekly summaries</option>
                    <option value="Monthly">Monthly reports</option>
                  </select>
                </div>
                
                <div className="bg-slate-700 p-5 rounded-xl">
                  <h3 className="text-lg font-medium text-slate-100 mb-3">Review Your Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="font-medium">{formData.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Age:</span>
                      <span className="font-medium">{formData.age}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Profession:</span>
                      <span className="font-medium">{formData.profession}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monthly Income:</span>
                      <span className="font-medium">₹{parseInt(formData.monthly_salary_inr).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Financial Goals:</span>
                      <span className="font-medium text-right">{formData.financial_goals.join(', ')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="privacy_consent"
                    name="privacy_consent"
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                    required
                  />
                  <label htmlFor="privacy_consent" className="ml-2 text-slate-300 text-sm">
                    I agree to FinDost's <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a> and <a href="#" className="text-indigo-400 hover:underline">Terms of Service</a>
                  </label>
                </div>
              </div>
            )}
            
            {/* Navigation buttons */}
            <div className="mt-8 flex justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-all flex items-center shadow-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                  Back
                </button>
              ) : (
                <div></div> // Empty div to maintain layout
              )}
              
              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all flex items-center shadow-lg"
                >
                  Next
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all flex items-center shadow-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <BeatLoader color="#ffffff" size={8} className="mr-2" />
                      Creating Profile
                    </>
                  ) : (
                    <>
                      Complete Profile
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
            {submitError && (
              <div className="mt-4 text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-md px-4 py-2">
                <p className="font-medium">{submitError}</p>
                <details className="mt-2 text-xs whitespace-pre-wrap">
                  <summary className="cursor-pointer text-red-300">Show setup SQL & troubleshooting</summary>
                  {`-- Create profiles table (run in Supabase SQL editor)\ncreate table if not exists public.profiles (\n  id uuid primary key references auth.users(id) on delete cascade,\n  full_name text,\n  age int,\n  gender text,\n  profession text,\n  monthly_salary_inr int,\n  employment_type text,\n  monthly_expenses int,\n  financial_goals text[] default '{}',\n  risk_tolerance text,\n  investment_experience text,\n  has_loans boolean default false,\n  loan_types text[] default '{}',\n  monthly_loan_payments int,\n  communication_preference text,\n  notification_frequency text,\n  created_at timestamptz default now()\n);\n\n-- Enable Row Level Security\nalter table public.profiles enable row level security;\n\n-- Policies\ncreate policy "Profiles Select Own" on public.profiles for select using ( auth.uid() = id );\ncreate policy "Profiles Insert Own" on public.profiles for insert with check ( auth.uid() = id );\ncreate policy "Profiles Update Own" on public.profiles for update using ( auth.uid() = id );\n\n-- If you already created policies, ignore duplicates.\n-- After running, retry profile creation.`}
                </details>
                {debugInfo?.removedColumns?.length > 0 && (
                  <details className="mt-3 text-xs whitespace-pre-wrap">
                    <summary className="cursor-pointer text-red-300">Show SQL to add missing columns ({debugInfo.removedColumns.join(', ')})</summary>
                    <div className="mt-2">
                      <pre className="bg-slate-950/60 p-2 rounded border border-slate-700 overflow-auto max-h-40">{debugInfo.generatedColumnSql}</pre>
                      <p className="mt-2 text-[10px] text-slate-400">After running the ALTER statements, re-submit your profile. Columns were auto-removed temporarily so you could proceed.</p>
                    </div>
                  </details>
                )}
              </div>
            )}
            <div className="mt-4 text-xs text-slate-500 flex items-center gap-4">
              <button type="button" onClick={() => setShowDebug(!showDebug)} className="underline hover:text-indigo-400">
                {showDebug ? 'Hide' : 'Show'} debug
              </button>
              <button
                type="button"
                onClick={async () => {
                  const t0 = performance.now();
                  const { data: test, error: testError } = await supabase.from('profiles').select('id').limit(1);
                  const dur = Math.round(performance.now() - t0);
                  const diag = { testError, rowCount: test?.length || 0, durationMs: dur, time: new Date().toISOString() };
                  console.log('[Diagnostics] Manual probe', diag);
                  setDebugInfo(d => ({ ...d, manualProbe: diag }));
                  if (testError) toast.error('Profiles table probe failed: '+ testError.message);
                  else toast.success('Profiles table reachable');
                }}
                className="underline hover:text-indigo-400"
              >Test connection</button>
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  const { data: verifyRow, error: verifyError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();
                  setDebugInfo(d => ({ ...d, manualVerify: { verifyRow, verifyError, at: new Date().toISOString() } }));
                  if (verifyRow) toast.success('Verify: row present'); else if (verifyError) toast.error('Verify error: '+verifyError.message); else toast.warning('No row yet for this user');
                }}
                className="underline hover:text-indigo-400"
              >Verify row</button>
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  const payload = buildProfileData();
                  const { error } = await supabase.from('profiles').upsert(payload, { returning: 'minimal' });
                  setDebugInfo(d => ({ ...d, manualForceUpsert: { ok: !error, error, payload, at: new Date().toISOString() } }));
                  if (error) toast.error('Force upsert error: '+error.message); else toast.success('Force upsert attempted');
                }}
                className="underline hover:text-indigo-400"
              >Force upsert</button>
              {loading && <span className="animate-pulse">Submitting...</span>}
            </div>
            {showDebug && (
              <pre className="mt-2 max-h-48 overflow-auto text-[10px] bg-slate-800/70 p-3 rounded border border-slate-700 whitespace-pre-wrap break-all">
{JSON.stringify(debugInfo, null, 2)}
              </pre>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

// ==================== Main App Component ====================
function MainApp({ session, profile, setProfile, darkMode, setDarkMode }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark', !darkMode);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200">
      {/* Sidebar */}
      <Sidebar 
        profile={profile} 
        activeView={activeView} 
        setActiveView={setActiveView} 
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        setShowProfileModal={setShowProfileModal}
      />

      {/* Main Content */}
      <div className={`flex-1 overflow-hidden transition-all duration-200 ${isSidebarCollapsed ? 'ml-20' : 'ml-0'}`}>
        <div className="h-full flex flex-col">
          {/* Top Navigation */}
          <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">
                {activeView === 'dashboard' ? 'Dashboard' : 'Chat with FinDost'}
              </h1>
              <div className="flex items-center space-x-4">
                <button 
                  className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                  onClick={() => {}}
                >
                  <FaBell />
                </button>
                <button 
                  className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                  onClick={() => setShowProfileModal(true)}
                >
                  <FaUser />
                </button>
              </div>
            </div>
          </header>
          
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-slate-900">
            {activeView === 'dashboard' ? (
              <DashboardView profile={profile} setActiveView={setActiveView} />
            ) : (
              <ChatView session={session} profile={profile} />
            )}
          </div>
        </div>
      </div>
      
      {/* Profile Modal */}
      <ProfileModal 
        isOpen={showProfileModal} 
        setIsOpen={setShowProfileModal} 
        profile={profile}
        setProfile={setProfile}
      />
    </div>
  );
}

// ==================== Profile Modal Component ====================
function ProfileModal({ isOpen, setIsOpen, profile, setProfile }) {
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    profession: profile?.profession || '',
    monthly_salary_inr: profile?.monthly_salary_inr || '',
  monthly_expenses: profile?.monthly_expenses || '',
  });
  const [loading, setLoading] = useState(false);

  // Reset form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        profession: profile.profession || '',
        monthly_salary_inr: profile.monthly_salary_inr || '',
  monthly_expenses: profile.monthly_expenses || '',
      });
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare update data
      const updateData = {
        ...formData,
        monthly_salary_inr: parseInt(formData.monthly_salary_inr),
  monthly_expenses: parseInt(formData.monthly_expenses) || 0,
      };

      // Update profile in Supabase
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select();

      if (error) throw error;

      // Update local profile state
      setProfile({ ...profile, ...data[0] });
      toast.success('Profile updated successfully!');
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => setIsOpen(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-70" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-800 p-6 text-left align-middle shadow-xl transition-all border border-slate-700">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-white mb-4"
                >
                  Edit Your Profile
                </Dialog.Title>
                
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-slate-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        id="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="profession" className="block text-sm font-medium text-slate-300 mb-1">
                        Profession
                      </label>
                      <input
                        type="text"
                        name="profession"
                        id="profession"
                        value={formData.profession}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="monthly_salary_inr" className="block text-sm font-medium text-slate-300 mb-1">
                        Monthly Income (₹)
                      </label>
                      <input
                        type="number"
                        name="monthly_salary_inr"
                        id="monthly_salary_inr"
                        value={formData.monthly_salary_inr}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                        required
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="monthly_expenses" className="block text-sm font-medium text-slate-300 mb-1">
                        Monthly Expenses (₹)
                      </label>
                      <input
                        type="number"
                        name="monthly_expenses"
                        id="monthly_expenses"
                        value={formData.monthly_expenses}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                      disabled={loading}
                    >
                      {loading ? <BeatLoader color="#ffffff" size={8} /> : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// ==================== Sidebar Component ====================
function Sidebar({ 
  profile, 
  activeView, 
  setActiveView, 
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  darkMode,
  toggleDarkMode,
  setShowProfileModal
}) {
  const handleSignOut = async () => {
    try {
      toast.info("Signing out...");
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error("Error signing out. Please try again.");
    }
  };

  return (
    <div 
      className={`bg-slate-800 text-white flex flex-col h-full border-r border-slate-700 transition-all duration-200 ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo & Collapse Button */}
      <div className={`flex items-center p-4 border-b border-slate-700 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isSidebarCollapsed && (
          <div className="flex items-center">
            <div className="bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3">
              <FaPiggyBank className="text-white text-lg" />
            </div>
            <h2 className="font-bold text-xl bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">FinDost</h2>
          </div>
        )}
        
        {isSidebarCollapsed && (
          <div className="bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center">
            <FaPiggyBank className="text-white text-lg" />
          </div>
        )}
        
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`p-1 text-slate-400 hover:text-white transition-colors ${isSidebarCollapsed ? 'hidden' : 'block'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* User Info */}
      <div className={`p-4 border-b border-slate-700 ${isSidebarCollapsed ? 'text-center' : ''}`}>
        <div className={`${isSidebarCollapsed ? 'mx-auto' : ''} w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4`}>
          <span className="text-xl font-bold">{profile.full_name ? profile.full_name[0].toUpperCase() : 'U'}</span>
        </div>
        {!isSidebarCollapsed && (
          <>
            <h2 className="font-medium text-lg truncate">{profile.full_name}</h2>
            <p className="text-slate-400 text-sm truncate">{profile.profession}</p>
            <button 
              onClick={() => setShowProfileModal(true)}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center"
            >
              Edit Profile <FaChevronRight className="ml-1" size={8} />
            </button>
          </>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} items-center px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors ${
                activeView === 'dashboard' ? 'bg-indigo-600 hover:bg-indigo-700' : ''
              }`}
            >
              <FaChartBar className={`${isSidebarCollapsed ? '' : 'mr-3'} text-xl`} />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveView('chat')}
              className={`w-full flex ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} items-center px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors ${
                activeView === 'chat' ? 'bg-indigo-600 hover:bg-indigo-700' : ''
              }`}
            >
              <FaComment className={`${isSidebarCollapsed ? '' : 'mr-3'} text-xl`} />
              {!isSidebarCollapsed && <span>Chat with FinDost</span>}
            </button>
          </li>
          
          {!isSidebarCollapsed && (
            <div className="pt-4 mt-4 border-t border-slate-700">
              <h3 className="px-4 text-xs uppercase text-slate-500 font-semibold mb-2">Financial Tools</h3>
            </div>
          )}
          
          <li>
            <button
              onClick={() => {}}
              className={`w-full flex ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} items-center px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors`}
            >
              <FaWallet className={`${isSidebarCollapsed ? '' : 'mr-3'} text-xl`} />
              {!isSidebarCollapsed && <span>Budget Tracker</span>}
            </button>
          </li>
          <li>
            <button
              onClick={() => {}}
              className={`w-full flex ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} items-center px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors`}
            >
              <FaPiggyBank className={`${isSidebarCollapsed ? '' : 'mr-3'} text-xl`} />
              {!isSidebarCollapsed && <span>Savings Goals</span>}
            </button>
          </li>
          <li>
            <button
              onClick={() => {}}
              className={`w-full flex ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} items-center px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors`}
            >
              <FaCreditCard className={`${isSidebarCollapsed ? '' : 'mr-3'} text-xl`} />
              {!isSidebarCollapsed && <span>Expense Analyzer</span>}
            </button>
          </li>
        </ul>
      </nav>

      {/* Bottom Actions */}
      <div className={`p-2 border-t border-slate-700 ${isSidebarCollapsed ? 'text-center' : ''}`}>
        <button
          onClick={toggleDarkMode}
          className={`w-full flex ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} items-center px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors mb-2`}
        >
          <FaCog className={`${isSidebarCollapsed ? '' : 'mr-3'} text-xl`} />
          {!isSidebarCollapsed && <span>Settings</span>}
        </button>
        <button
          onClick={handleSignOut}
          className={`w-full flex ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} items-center px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors`}
        >
          <FaSignOutAlt className={`${isSidebarCollapsed ? '' : 'mr-3'} text-xl`} />
          {!isSidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}

// ==================== Dashboard View Component ====================
function DashboardView({ profile, setActiveView }) {
  // Calculate some financial metrics
  const monthlyIncome = profile.monthly_salary_inr || 0;
  const monthlyExpenses = profile.monthly_expenses || Math.round(monthlyIncome * 0.6);
  const monthlySavings = Math.max(0, monthlyIncome - monthlyExpenses);
  const savingsPercentage = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0;
  
  // Emergency fund (6 months of expenses)
  const emergencyFundGoal = monthlyExpenses * 6;
  const emergencyFundCurrent = Math.round(emergencyFundGoal * 0.25); // Mock data: 25% of goal
  const emergencyFundPercentage = Math.round((emergencyFundCurrent / emergencyFundGoal) * 100);
  
  // Chart data for monthly spending
  const monthlySpendingData = {
    labels: ['Housing', 'Food', 'Transport', 'Entertainment', 'Utilities', 'Other'],
    datasets: [
      {
        label: 'Spending by Category',
        data: [
          Math.round(monthlyExpenses * 0.35), // Housing
          Math.round(monthlyExpenses * 0.20), // Food
          Math.round(monthlyExpenses * 0.15), // Transport
          Math.round(monthlyExpenses * 0.10), // Entertainment
          Math.round(monthlyExpenses * 0.10), // Utilities
          Math.round(monthlyExpenses * 0.10), // Other
        ],
        backgroundColor: [
          '#6366f1', // indigo-500
          '#8b5cf6', // violet-500
          '#3b82f6', // blue-500
          '#06b6d4', // cyan-500
          '#f59e0b', // amber-500
          '#64748b', // slate-500
        ],
        borderColor: 'rgba(0, 0, 0, 0)',
        hoverOffset: 4
      }
    ]
  };
  
  // Chart options
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e2e8f0', // slate-200
          font: {
            size: 12
          }
        }
      }
    }
  };
  
  // Mock data for income trend chart
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const incomeTrendData = {
    labels: months,
    datasets: [
      {
        label: 'Income',
        data: months.map(() => monthlyIncome + Math.floor(Math.random() * 10000 - 5000)), // Random variation
        borderColor: '#6366f1', // indigo-500
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Expenses',
        data: months.map(() => monthlyExpenses + Math.floor(Math.random() * 5000 - 2500)), // Random variation
        borderColor: '#f87171', // red-400
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
  
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.1)' // slate-400 with opacity
        },
        ticks: {
          color: '#94a3b8' // slate-400
        }
      },
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)' // slate-400 with opacity
        },
        ticks: {
          color: '#94a3b8' // slate-400
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: '#e2e8f0' // slate-200
        }
      },
      tooltip: {
        intersect: false,
        mode: 'index'
      }
    }
  };
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome Section with Financial Summary */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome, {profile.full_name}!</h1>
            <p className="text-slate-400">Here's your financial overview for August 2025</p>
          </div>
          <button 
            onClick={() => setActiveView('chat')}
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors"
          >
            <FaComment className="mr-2" /> Chat with FinDost
          </button>
        </div>
        
        {/* Key Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Income Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700 shadow-lg">
            <div className="flex justify-between items-center">
              <h3 className="text-slate-400 text-sm font-medium">Monthly Income</h3>
              <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center">
                <HiOutlineCash className="text-indigo-400 text-xl" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-2">₹{monthlyIncome.toLocaleString()}</p>
            <div className="flex items-center mt-3">
              <span className="text-emerald-400 text-sm flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                2.5% vs. last month
              </span>
            </div>
          </div>
          
          {/* Savings Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700 shadow-lg">
            <div className="flex justify-between items-center">
              <h3 className="text-slate-400 text-sm font-medium">Monthly Savings</h3>
              <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center">
                <FaPiggyBank className="text-emerald-400 text-xl" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-2">₹{monthlySavings.toLocaleString()}</p>
            <div className="flex items-center mt-3">
              <span className={`text-sm flex items-center ${savingsPercentage >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {savingsPercentage}% of your monthly income
              </span>
            </div>
          </div>
          
          {/* Emergency Fund Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700 shadow-lg">
            <div className="flex justify-between items-center">
              <h3 className="text-slate-400 text-sm font-medium">Emergency Fund</h3>
              <div className="w-10 h-10 rounded-full bg-cyan-900/30 flex items-center justify-center">
                <HiOutlineShieldCheck className="text-cyan-400 text-xl" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-2">₹{emergencyFundCurrent.toLocaleString()}</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Goal: ₹{emergencyFundGoal.toLocaleString()}</span>
                <span>{emergencyFundPercentage}% complete</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    emergencyFundPercentage < 25 ? 'bg-red-500' : 
                    emergencyFundPercentage < 75 ? 'bg-amber-500' : 
                    'bg-emerald-500'
                  }`}
                  style={{ width: `${emergencyFundPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Income vs. Expenses Chart */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
          <h3 className="text-lg font-medium text-white mb-4">Income vs. Expenses Trend</h3>
          <div className="h-64">
            <Line data={incomeTrendData} options={lineOptions} />
          </div>
        </div>
        
        {/* Monthly Spending Breakdown */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
          <h3 className="text-lg font-medium text-white mb-4">Monthly Spending Breakdown</h3>
          <div className="h-64 flex items-center justify-center">
            <Doughnut data={monthlySpendingData} options={doughnutOptions} />
          </div>
        </div>
      </div>
      
      {/* Financial Insights Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Financial Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Insight Card 1 */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
            <div className="flex">
              <div className="mr-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-900/30 flex items-center justify-center">
                  <FaRegLightbulb className="text-indigo-400 text-xl" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Savings Rate Analysis</h3>
                <p className="text-slate-300 mb-3">
                  Your current savings rate is <span className="font-semibold text-indigo-400">{savingsPercentage}%</span> of your income. 
                  {savingsPercentage >= 20 
                    ? " That's excellent! You're on track to meet your financial goals." 
                    : " Financial experts recommend saving at least 20% of your income."}
                </p>
                <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center">
                  Get savings tips <HiOutlineArrowSmRight className="ml-1" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Insight Card 2 */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
            <div className="flex">
              <div className="mr-4">
                <div className="w-12 h-12 rounded-lg bg-amber-900/30 flex items-center justify-center">
                  <FaRegLightbulb className="text-amber-400 text-xl" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Tax Saving Opportunity</h3>
                <p className="text-slate-300 mb-3">
                  Based on your income bracket, you could save up to <span className="font-semibold text-amber-400">₹45,000</span> in taxes 
                  by maximizing your Section 80C investments.
                </p>
                <button className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center">
                  Explore tax saving options <HiOutlineArrowSmRight className="ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Goal Progress */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Financial Goals</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
          {/* Goal 1 */}
          <div className="p-5 border-b border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-white">Emergency Fund</h3>
              <span className="text-emerald-400 text-sm">{emergencyFundPercentage}% complete</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
              <div 
                className="bg-emerald-500 h-2 rounded-full"
                style={{ width: `${emergencyFundPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Current: ₹{emergencyFundCurrent.toLocaleString()}</span>
              <span className="text-slate-400">Goal: ₹{emergencyFundGoal.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Goal 2 */}
          <div className="p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-white">Down Payment for Home</h3>
              <span className="text-indigo-400 text-sm">15% complete</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
              <div 
                className="bg-indigo-500 h-2 rounded-full"
                style={{ width: '15%' }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Current: ₹300,000</span>
              <span className="text-slate-400">Goal: ₹2,000,000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Chat View Component ====================
function ChatView({ session, profile }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([
    "How can I build an emergency fund?",
    "What investments are best for beginners?",
    "How to save for retirement in India?",
    "How to budget effectively?",
    "What are tax-saving investment options?",
    "Should I pay off debt or invest first?"
  ]);
  const messagesEndRef = React.useRef(null);
  const chatContainerRef = React.useRef(null);

  // Fetch chat history on component mount
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching chat history:', error);
          toast.error("Couldn't load your chat history. Please try refreshing.");
          return;
        }

        setMessages(data || []);
      } catch (error) {
        console.error('Unexpected error fetching chat history:', error);
        toast.error("Something went wrong loading your chat history.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatHistory();
  }, [session]);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    try {
      // Get the current timestamp
      const timestamp = new Date();
      
      // Prepare the user message object
      const userMessage = {
        user_id: session.user.id,
        sender: 'user',
        message: newMessage,
        created_at: timestamp.toISOString(),
      };

      // Update UI immediately
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setNewMessage('');
      setIsLoading(true);

      // Insert user message into Supabase
      const { error: userMsgError } = await supabase
        .from('chats')
        .insert(userMessage);

      if (userMsgError) {
        console.error('Error saving user message:', userMsgError);
        toast.error("Failed to save your message. We'll still try to get a response.");
      }

      // Get recent chat history for context (last 10 messages)
      const chatHistory = messages.slice(-10).map(msg => ({
        sender: msg.sender,
        message: msg.message
      }));

      // Send message to backend
      const response = await fetch('http://localhost:5001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage,
          profile: profile,
          chatHistory: [...chatHistory, { sender: 'user', message: newMessage }]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();

      // Prepare AI response object
      const aiResponse = {
        user_id: session.user.id,
        sender: 'ai',
        message: data.reply,
        created_at: new Date().toISOString(),
      };

      // Update UI with AI response
      setMessages(prevMessages => [...prevMessages, aiResponse]);

      // Insert AI response into Supabase
      const { error: aiMsgError } = await supabase
        .from('chats')
        .insert(aiResponse);

      if (aiMsgError) {
        console.error('Error saving AI response:', aiMsgError);
      }

      // Generate new suggestions based on the conversation
      const newSuggestions = generateNewSuggestions(data.reply);
      if (newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
      }

    } catch (error) {
      console.error('Error sending/receiving message:', error);
      // Show error in chat
      setMessages(prevMessages => [
        ...prevMessages,
        {
          user_id: session.user.id,
          sender: 'ai',
          message: "I'm sorry, I'm having trouble connecting right now. Please try again later.",
          created_at: new Date().toISOString(),
        }
      ]);
      toast.error("Failed to get a response. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate new suggestions based on AI response
  const generateNewSuggestions = (aiResponse) => {
    const suggestionsPool = [
      "How much should I be saving each month?",
      "What's the 50/30/20 budget rule?",
      "How do I start investing in mutual funds?",
      "Can you explain SIPs?",
      "How to plan for retirement in my 20s?",
      "Should I invest in PPF or NPS?",
      "How to reduce my monthly expenses?",
      "What's the difference between term and whole life insurance?",
      "How to build a credit score?",
      "Best ways to save tax under Section 80C?",
      "Should I buy or rent a home?",
      "How to manage irregular income?",
      "What's the best way to track expenses?",
      "How to pay off student loans faster?",
      "What are index funds?",
      "Is gold a good investment?",
      "How much emergency fund should I have?",
      "What's a good debt-to-income ratio?"
    ];
    
    // Simple shuffle and pick algorithm
    const shuffled = [...suggestionsPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setNewMessage(suggestion);
  };

  const formatMessageDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Chat Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 chat-scrollbar"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="mb-4">
                <BeatLoader color="#6366f1" size={10} />
              </div>
              <h3 className="font-medium text-slate-200 mb-1">Loading your conversation</h3>
              <p className="text-slate-400 max-w-xs">
                We're getting your chat history ready...
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="bg-indigo-900/30 p-4 rounded-full mx-auto mb-6 w-20 h-20 flex items-center justify-center">
                <FaComment className="text-indigo-400 text-3xl" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Chat with FinDost</h3>
              <p className="text-slate-300 mb-8">
                I'm your AI financial coach. Ask me anything about saving, investing, budgeting, or any financial questions you have!
              </p>
              
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors text-slate-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Welcome message if this is first message of the day */}
            {messages.length > 0 && (
              <div className="flex justify-center mb-6">
                <div className="bg-slate-800/50 rounded-full px-4 py-1.5 text-xs text-slate-400">
                  Today, {new Date().toLocaleDateString()}
                </div>
              </div>
            )}
            
            {/* Messages */}
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              const showTime = index === 0 || messages[index - 1]?.sender !== msg.sender;
              
              return (
                <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] md:max-w-[70%]">
                    {!isUser && showTime && (
                      <div className="flex items-center mb-1 ml-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center mr-2">
                          <FaPiggyBank className="text-white text-xs" />
                        </div>
                        <span className="text-xs text-slate-400">FinDost • {formatMessageDate(msg.created_at)}</span>
                      </div>
                    )}
                    
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                      }`}
                    >
                      {msg.isUser ? (
                        <p>{msg.message}</p>
                      ) : (
                        msg.isLoading ? (
                          <PulseLoader color="#a5b4fc" size={8} />
                        ) : (
                          <div className="prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown>{msg.message}</ReactMarkdown>
                          </div>
                        )
                      )}
                    </div>
                    
                    {isUser && showTime && (
                      <div className="flex justify-end mt-1 mr-2">
                        <span className="text-xs text-slate-400">{formatMessageDate(msg.created_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* AI Typing Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] md:max-w-[70%]">
                  <div className="flex items-center mb-1 ml-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center mr-2">
                      <FaPiggyBank className="text-white text-xs" />
                    </div>
                    <span className="text-xs text-slate-400">FinDost is typing...</span>
                  </div>
                  <div className="bg-slate-800 text-slate-100 rounded-2xl rounded-tl-none px-4 py-3 border border-slate-700">
                    <div className="flex space-x-2">
                      <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
                      <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Suggested next questions after AI response */}
            {!isLoading && messages.length > 0 && messages[messages.length - 1].sender === 'ai' && (
              <div className="mt-6 space-y-2">
                <p className="text-xs text-slate-400 ml-2">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-sm text-slate-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} className="pt-4" /> {/* Space at bottom of chat */}
          </>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-slate-800 p-4">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask FinDost anything about your finances..."
            className="flex-1 p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <PulseLoader color="#ffffff" size={6} />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            )}
          </button>
        </form>
        <div className="text-xs text-slate-500 mt-2 text-center">
          FinDost provides general financial information, not specific financial advice. Always consult with a professional for important decisions.
        </div>
      </div>
    </div>
  );
}

export default App;
