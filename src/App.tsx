/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Send, User, MessageSquare, Calendar, Search, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  skills: string[];
  hospital: string;
  fitScore: number;
  image: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Hey, I need to find information about my condition, specifically to find a doctor for my Type 2 health history.',
    sender: 'user',
  },
  {
    id: '2',
    text: 'AI/Backend: We are processing your request and analyzing your health history, conditions, and past medical history to make an accurate match.',
    sender: 'ai',
  },
];

const DOCTORS: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Jane Doe',
    specialty: 'Endocrinologist',
    skills: ['Type 1', 'Type 2', 'Diabetes'],
    hospital: 'Metro Hospital',
    fitScore: 98,
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane',
  },
  {
    id: '2',
    name: 'Dr. John Doe',
    specialty: 'Endocrinologist',
    skills: ['Type 1', 'Type 2', 'Diabetes'],
    hospital: 'Metro Hospital',
    fitScore: 98,
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  },
  {
    id: '3',
    name: 'Dr. Alice Doe',
    specialty: 'Endocrinologist',
    skills: ['Type 1', 'Type 2', 'Diabetes'],
    hospital: 'Metro Hospital',
    fitScore: 98,
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
  },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm analyzing your input to refine the doctor matches. Please hold on a moment...",
        sender: 'ai',
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-8 h-8 text-emerald-600" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 uppercase">
            Medical Profile & Matchmaking Portal
          </h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 overflow-hidden">
          <img 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
            alt="User Profile" 
            className="w-full h-full object-cover"
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Consult & Matchmaking */}
        <section className="lg:col-span-7 flex flex-col h-[calc(100vh-180px)]">
          <h2 className="text-xl font-bold mb-6 text-center uppercase tracking-wide text-gray-700">
            Consult & Matchmaking
          </h2>
          
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-y-auto mb-4 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl shadow-sm relative ${
                      msg.sender === 'user'
                        ? 'bg-emerald-50 text-emerald-900 rounded-tr-none border border-emerald-100'
                        : 'bg-blue-50 text-blue-900 rounded-tl-none border border-blue-100'
                    }`}
                  >
                    <p className="text-sm md:text-base leading-relaxed">{msg.text}</p>
                    {/* Bubble tail simulation */}
                    <div 
                      className={`absolute top-0 w-4 h-4 ${
                        msg.sender === 'user' 
                          ? '-right-2 bg-emerald-50 border-r border-t border-emerald-100 rotate-45' 
                          : '-left-2 bg-blue-50 border-l border-t border-blue-100 -rotate-45'
                      }`}
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Describe symptoms or specific medical needs (e.g., 'Specialist for autoimmune disease')"
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
            />
            <button
              onClick={handleSend}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-md flex items-center gap-2 uppercase tracking-wider text-sm"
            >
              Send
              <Send className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Right Column: Top Matches */}
        <section className="lg:col-span-5 flex flex-col h-[calc(100vh-180px)] border-l lg:pl-8 border-gray-200">
          <h2 className="text-xl font-bold mb-6 text-center uppercase tracking-wide text-gray-700">
            Top Matches
          </h2>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {DOCTORS.map((doc) => (
              <motion.div
                key={doc.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                  <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-900 truncate">
                      {doc.name} <span className="font-normal text-gray-500">| {doc.specialty}</span>
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">
                    <span className="font-semibold">Skills:</span> {doc.skills.join(', ')}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">
                    <span className="font-semibold">{doc.hospital}</span> | Fit Score: <span className="text-emerald-600 font-bold">{doc.fitScore}%</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold py-2 px-3 rounded-lg uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Message
                    </button>
                    <button className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold py-2 px-3 rounded-lg uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Book
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </div>
  );
}
