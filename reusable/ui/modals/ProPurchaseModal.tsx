"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Check, Zap, ArrowRight, ShieldCheck, X, Copy, Share2, Download } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, orderBy, limit } from 'firebase/firestore';

interface ProPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLANS = [
  { id: '7days', name: '7 Days', price: 9, originalPrice: 199, duration: 7 },
  { id: '30days', name: '30 Days', price: 29, originalPrice: 499, duration: 30, popular: true },
];

export default function ProPurchaseModal({ isOpen, onClose }: ProPurchaseModalProps) {
  const { user, userName } = useAuth();
  const { showToast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]);
  const [step, setStep] = useState<'selection' | 'payment' | 'done'>('selection');
  const [loading, setLoading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [existingRequestId, setExistingRequestId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const emailPrefix = user?.email?.split('@')[0] || 'User';
  const upiId = 'mishraabhiyank0-1@okhdfcbank';
  const payeeName = 'Abhiyank Mishra';
  const note = `${emailPrefix} Pro Subscription`;
  
  const { upiUrl, transactionId, transactionRef } = useMemo(() => {
    const amountStr = `${selectedPlan.price}.00`;
    const tid = `TID${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const tr = `TXN${Date.now()}`;
    const url = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amountStr}&cu=INR&tn=${encodeURIComponent(note)}&tid=${tid}&tr=${tr}&mc=123456`;
    return { upiUrl: url, transactionId: tid, transactionRef: tr };
  }, [selectedPlan.price, note]);

  // Check for existing pending request on open
  const checkExistingRequest = async () => {
    if (!user) return false;
    try {
      const q = query(
        collection(db, 'subscriptionRequests'),
        where('userId', '==', user.uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setExistingRequestId(snap.docs[0].id);
        setStep('done');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to check existing request:', e);
      return false;
    }
  };

  // Check on first open — MUST be before any early returns (Rules of Hooks)
  React.useEffect(() => {
    if (isOpen && user) {
      checkExistingRequest();
    }
    if (!isOpen) {
      // Reset state when modal closes
      setStep('selection');
      setShowQRCode(false);
      setExistingRequestId(null);
    }
  }, [isOpen, user]);

  if (!user) return null;
  const handlePaid = async () => {
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'subscriptionRequests'), {
        userId: user.uid,
        userName: userName || user.displayName || 'Unknown',
        email: user.email,
        emailPrefix,
        plan: selectedPlan.id,
        amount: selectedPlan.price,
        transactionId,
        transactionRef,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setExistingRequestId(docRef.id);
      setStep('done');
    } catch (e: any) {
      showToast('Failed to submit request: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!existingRequestId) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, 'subscriptionRequests', existingRequestId), { 
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      });
      setExistingRequestId(null);
      setStep('selection');
      setShowQRCode(false);
      showToast('Payment request cancelled. You can try again anytime.', 'info');
    } catch (e: any) {
      showToast('Failed to cancel request: ' + e.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied!`, 'success');
  };

  const shareQRCode = async () => {
    try {
      const canvas = document.getElementById('qr-canvas-hidden') as HTMLCanvasElement;
      if (!canvas) {
        showToast('QR Code not ready yet.', 'error');
        return;
      }

      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast('Failed to generate image.', 'error');
          return;
        }

        const file = new File([blob], 'muse_pro_payment_qr.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Pay for Muse Pro',
              text: 'Scan this QR code with any UPI app to upgrade to Muse Pro.',
              files: [file],
            });
          } catch (error: any) {
            if (error.name !== 'AbortError') {
              // User didn't cancel, something else went wrong
              showToast('Error sharing. Try saving the QR manually.', 'error');
            }
          }
        } else {
          // Fallback: Download image if Web Share API is not supported
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'muse_pro_payment_qr.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('QR Code downloaded! Open your UPI app to scan it from gallery.', 'success');
        }
      }, 'image/png');

    } catch (error) {
       showToast('Failed to process QR code.', 'error')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="relative w-full max-w-lg md:max-w-4xl bg-[#0a0a0b]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
          >
            {/* Subtle background glow orbs */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
            {/* Header */}
            <div className="relative p-4 md:p-8 pb-2 md:pb-4 text-center">
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-3xl flex items-center justify-center mx-auto mb-3 md:mb-6 shadow-lg shadow-amber-500/20 rotate-3">
                <Crown className="w-6 h-6 md:w-8 md:h-8 text-black fill-black" />
              </div>
              
              <h2 className="text-xl md:text-3xl font-black text-white mb-1 md:mb-2 tracking-tight">
                {step === 'selection' ? 'Upgrade to Pro' : step === 'payment' ? 'Complete Payment' : 'Request Submitted'}
              </h2>
              <p className="text-gray-400 text-sm font-medium">
                {step === 'selection' ? 'Unlock downloads, offline mode, and high-quality streaming.' : step === 'payment' ? 'Scan the QR code below to pay via any UPI app.' : "We'll verify your payment and activate Pro status shortly."}
              </p>
            </div>

            {/* Selection Step */}
            {step === 'selection' && (
              <div className="p-4 md:p-8 pt-2 md:pt-4 space-y-3 md:space-y-6">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {PLANS.map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`relative p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 transition-all cursor-pointer group ${
                        selectedPlan.id === plan.id 
                          ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/5' 
                          : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-2.5 right-3 bg-amber-500 text-black text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-lg">
                          Best Value
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-2 md:gap-0 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${selectedPlan.id === plan.id ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400'}`}>
                            <Zap className="w-4 h-4 md:w-6 md:h-6 fill-current" />
                          </div>
                          <div>
                            <h3 className="font-black text-white text-base md:text-xl">{plan.name}</h3>
                            <p className="text-[9px] md:text-xs text-gray-400 font-bold uppercase tracking-wider">Plan Duration</p>
                          </div>
                        </div>
                        <div className="text-left md:text-right">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm md:text-base text-gray-500 line-through decoration-red-500/50 decoration-2 font-bold">₹{plan.originalPrice}</span>
                            <span className="text-xl md:text-2xl font-black text-white">₹{plan.price}</span>
                          </div>
                          <p className="text-[9px] md:text-[10px] text-amber-500 font-black uppercase tracking-widest mt-0.5">94% OFF Launch</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 md:space-y-3 bg-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5">
                  <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 md:mb-4 px-1">What you get</h4>
                  {[
                    'Download any song for offline use',
                    'Higher audio quality streaming',
                    'Unlimited active playlists',
                    'Exclusive Pro Member Badge'
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-gray-300">
                      <div className="w-4 h-4 md:w-5 md:h-5 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-500 stroke-[4px]" />
                      </div>
                      {feat}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setStep('payment')}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black py-3.5 md:py-5 rounded-2xl md:rounded-3xl text-sm font-black transition-all hover:bg-amber-400 active:scale-95 shadow-xl shadow-white/5"
                >
                  Continue to Pay <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Payment Step */}
            {step === 'payment' && (
              <div className="p-4 md:p-8 pt-2 md:pt-4">
                <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                  {/* Left Section: Payment Logic */}
                  <div className="flex-[1.2] w-full space-y-4 md:space-y-8">
                    <div className="space-y-3 md:space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Payment Status: Secured</span>
                        </div>
                        
                        <div className="space-y-3 md:space-y-6">
                            <div className="md:hidden w-full">
                                <button 
                                    onClick={shareQRCode}
                                    className="w-full h-12 md:h-16 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-black transition-all active:scale-95 group"
                                >
                                    Share & Pay with UPI App
                                    <Share2 className="w-4 h-4 fill-current" />
                                </button>
                                <p className="text-center text-[8px] text-gray-500 mt-1.5 font-bold uppercase tracking-widest">
                                    Downloads QR and opens share menu
                                </p>
                            </div>

                            <div className="p-4 md:p-6 bg-white/5 border border-white/5 rounded-3xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
                                
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Payable Amount</p>
                                        <p className="text-xl md:text-2xl font-black text-white">₹{selectedPlan.price}.00</p>
                                    </div>
                                    <div className="p-2.5 bg-green-500/10 rounded-xl">
                                        <Check className="w-5 h-5 text-green-500 stroke-[3px]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                  </div>

                   {/* Right Section: Visual Scan */}
                  <div className="flex-1 w-full flex flex-col pt-0 md:pt-2">
                    <div className="relative w-full min-h-[200px] md:min-h-[340px] flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 rounded-[2.5rem] overflow-hidden">
                        {/* Glow effect under QR */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-amber-500/5 blur-[80px] pointer-events-none" />
                        
                        {!showQRCode ? (
                           <button 
                                onClick={() => setShowQRCode(true)}
                                className="relative flex flex-col items-center gap-4 group"
                            >
                                <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 border border-white/10 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all duration-500 shadow-2xl">
                                    <Copy className="w-7 h-7 md:w-10 md:h-10 text-gray-400 group-hover:text-amber-500 transition-colors" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm md:text-base font-black text-white mb-0.5">Generate QR Code</p>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">For Desktop scanning</p>
                                </div>
                           </button>
                        ) : (
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative flex flex-col items-center"
                          >
                             <div className="bg-white p-3 md:p-6 rounded-2xl md:rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.5)] border-[4px] md:border-[8px] border-black/20 ring-1 ring-white/10">
                                <div className="hidden md:block">
                                  <QRCodeSVG 
                                    value={upiUrl} 
                                    size={180} 
                                    level="H"
                                    includeMargin={false}
                                    imageSettings={{
                                       src: "/logo.png",
                                       x: undefined,
                                       y: undefined,
                                       height: 35,
                                       width: 35,
                                       excavate: true,
                                    }}
                                  />
                                </div>
                                <div className="block md:hidden">
                                  <QRCodeSVG 
                                    value={upiUrl} 
                                    size={120} 
                                    level="H"
                                    includeMargin={false}
                                    imageSettings={{
                                       src: "/logo.png",
                                       x: undefined,
                                       y: undefined,
                                       height: 24,
                                       width: 24,
                                       excavate: true,
                                    }}
                                  />
                                </div>
                             </div>
                             <div className="mt-4 md:mt-8 text-center space-y-1">
                                <div className="flex items-center gap-2 justify-center">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                    <p className="text-xs md:text-sm font-black text-white uppercase tracking-tight">Active QR Frame</p>
                                </div>
                                <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest">Scan with any scanner</p>
                             </div>
                          </motion.div>
                        )}
                        
                        <div className="absolute bottom-10 flex items-center gap-2 opacity-20 pointer-events-none">
                             <ShieldCheck className="w-4 h-4 text-white" />
                             <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Verified UPI Payment</span>
                        </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:mt-10 flex flex-col md:flex-row gap-3 md:gap-4">
                  <button 
                    onClick={handlePaid}
                    disabled={loading}
                    className={`flex-[2] flex items-center justify-center gap-3 py-3.5 md:py-5 rounded-2xl text-sm md:text-lg font-black transition-all shadow-xl ${
                      loading ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:bg-amber-400 active:scale-95'
                    }`}
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-b-2 border-black rounded-full animate-spin" />
                    ) : (
                      <>I Have Completed Payment <Check className="w-4 h-4 stroke-[4px]" /></>
                    )}
                  </button>
                  <button 
                    onClick={() => setStep('selection')}
                    className="flex-[0.8] py-3 md:py-5 rounded-2xl border border-white/5 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all"
                  >
                    Change Plan
                  </button>
                  <button 
                    onClick={() => {
                      setStep('selection');
                      setShowQRCode(false);
                      showToast('No worries! You can try again when ready.', 'info');
                    }}
                    className="flex-[0.5] py-3 md:py-5 rounded-2xl border border-red-500/10 text-xs font-black text-red-400/60 uppercase tracking-widest hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
                {/* Hidden canvas for generating the downloadable/sharable image, placed unconditionally here */}
                <div className="hidden">
                    <QRCodeCanvas
                        id="qr-canvas-hidden"
                        value={upiUrl}
                        size={500}
                        level="H"
                        includeMargin={true}
                        imageSettings={{
                            src: "/logo.png",
                            x: undefined,
                            y: undefined,
                            height: 100,
                            width: 100,
                            excavate: true,
                        }}
                    />
                </div>
              </div>
            )}

            {/* Success Step */}
            {step === 'done' && (
              <div className="p-12 pt-6 text-center">
                <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                  <ShieldCheck className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-2xl font-black text-white mb-4">Request Pending</h3>
                <p className="text-gray-400 font-medium mb-6 leading-relaxed">
                  We've received your upgrade request. Our Admin will verify the payment and update your role to <span className="text-amber-500 font-bold">Pro</span> within 24 hours.
                </p>

                {/* Action buttons for stuck state resolution */}
                <div className="space-y-3">
                  <button 
                    onClick={onClose}
                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black transition-all hover:bg-white/10"
                  >
                    Return to Player
                  </button>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setStep('payment');
                        setShowQRCode(false);
                      }}
                      className="flex-1 py-3 rounded-2xl border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest hover:bg-amber-500/10 transition-all"
                    >
                      Retry Payment
                    </button>
                    <button 
                      onClick={handleCancelRequest}
                      disabled={cancelling}
                      className="flex-1 py-3 rounded-2xl border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling...' : 'Cancel Request'}
                    </button>
                  </div>
                  
                  <p className="text-[10px] text-gray-600 font-medium mt-2">
                    Didn't complete the payment? Cancel to start over.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
