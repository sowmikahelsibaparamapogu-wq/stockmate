import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Shield, Warehouse, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface DocumentCommentThreadProps {
  documentType: 'receipt' | 'delivery' | 'transfer' | 'adjustment';
  documentId: string;
  warehouseId?: number;
  title?: string;
}

export const DocumentCommentThread: React.FC<DocumentCommentThreadProps> = ({
  documentType,
  documentId,
  warehouseId,
  title = 'Document Notes & Operational Discussion',
}) => {
  const { token, dbUser } = useAuth();
  const { showToast } = useToast();

  const [comments, setComments] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    if (!token || !documentId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/comments?documentType=${encodeURIComponent(documentType)}&documentId=${encodeURIComponent(documentId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setComments(await res.json());
      }
    } catch (e: any) {
      console.error('Error fetching comments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [documentType, documentId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || submitting) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentType,
          documentId,
          warehouseId,
          message: newMessage.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to post note');
      }

      const created = await res.json();
      setComments((prev) => [...prev, created]);
      setNewMessage('');
      showToast('Note posted and targeted alert dispatched!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
            {title}
          </h4>
        </div>
        <span className="text-[10px] font-mono text-stone-500">
          Ref: {documentId}
        </span>
      </div>

      {/* Comments List */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center py-4 text-xs text-stone-400">Loading conversation...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-xs text-stone-400 italic">
            No notes on this document yet. Use this thread for short-ship reasons, carrier updates, or approvals.
          </div>
        ) : (
          comments.map((c) => {
            const isManager = c.author?.role === 'manager';
            const isMe = c.authorId === dbUser?.id;

            return (
              <div
                key={c.id}
                className={`p-3 rounded-lg text-xs space-y-1 border ${
                  isMe
                    ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                    : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    {isManager ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                        <Shield className="w-2.5 h-2.5" />
                        Manager
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                        <Warehouse className="w-2.5 h-2.5" />
                        Staff
                      </span>
                    )}
                    <span className="text-stone-900 dark:text-stone-100">{c.author?.name || 'User'}</span>
                    {isMe && <span className="text-[10px] text-stone-400 font-normal">(You)</span>}
                  </div>

                  <span className="text-[10px] text-stone-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {c?.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                  </span>
                </div>

                <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                  {c.message}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={`Add note to ${documentId} (e.g. why was this short-shipped?)...`}
          className="flex-1 text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || submitting}
          className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Post Note</span>
        </button>
      </form>
    </div>
  );
};
