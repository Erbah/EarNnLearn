'use client';
import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Share2, Copy, MessageCircle, Send, Twitter, Facebook, Hash } from 'lucide-react';

interface ShareModalProps {
  code: string;
  onClose: () => void;
}

export const ShareModal = React.memo(function ShareModal({ code, onClose }: ShareModalProps) {
  const shareText = useMemo(() => `Check out this activation code: ${code}`, [code]);
  const origin = useMemo(() => typeof window !== 'undefined' ? window.location.origin : 'https://earnnlearn.com', []);
  const url = useMemo(() => `${origin}/register?code=${code}&type=rid`, [origin, code]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  }, [code]);

  const handleNativeShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: 'Share Activation Code',
        text: shareText,
        url: url,
      }).catch(err => console.log('Share failed:', err));
    }
  }, [shareText, url]);

  const platforms = useMemo(() => [
    { name: 'WhatsApp', icon: <MessageCircle className="w-5 h-5" />, color: 'bg-[#25D366]', link: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}` },
    { name: 'Telegram', icon: <Send className="w-5 h-5" />, color: 'bg-[#0088CC]', link: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}` },
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, color: 'bg-[#1DA1F2]', link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}` },
    { name: 'Facebook', icon: <Facebook className="w-5 h-5" />, color: 'bg-[#1877F2]', link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { name: 'SMS', icon: <Hash className="w-5 h-5" />, color: 'bg-gray-600', link: `sms:?body=${encodeURIComponent(shareText + ' ' + url)}` },
  ], [shareText, url]);

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-white/10 w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6"
      >
        <div className="flex justify-between items-center text-white">
          <h3 className="text-xl font-bold">Share Code</h3>
          <div className="flex gap-2">
            {hasNativeShare && (
              <button onClick={handleNativeShare} title="Native Share" className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-all">
                <Share2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} title="Close Share Modal" className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <span className="font-mono text-primary font-bold text-lg">{code}</span>
          <button onClick={copyToClipboard} title="Copy Code" className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all">
            <Copy className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {platforms.map(p => (
            <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
              <div className={`w-14 h-14 rounded-2xl ${p.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {p.icon}
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.name}</span>
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
});

export default ShareModal;
