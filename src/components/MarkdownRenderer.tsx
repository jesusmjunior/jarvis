import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  isMariReport?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isMariReport }) => {
  return (
    <div className={`markdown-body ${isMariReport ? 'mari-report' : ''}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children, index }: any) => {
            // Check if children is a single string containing our custom tags
            if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
              const text = children[0];
              
              // Handle [VIDEO:url]
              if (text.includes('[VIDEO:')) {
                const match = text.match(/\[VIDEO:(.*?)\]/);
                if (match && match[1]) {
                  const url = match[1];
                  const embedUrl = url.includes('watch?v=') 
                    ? url.replace('watch?v=', 'embed/') 
                    : url.includes('youtu.be/') 
                      ? url.replace('youtu.be/', 'youtube.com/embed/')
                      : url;
                  
                  return (
                    <div className={`my-4 aspect-video rounded-xl overflow-hidden border border-white/10 shadow-lg ${isMariReport ? 'my-12 rounded-none border-zinc-900 shadow-none' : ''}`}>
                      <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />
                    </div>
                  );
                }
              }

              // Handle [IMAGE:prompt]
              if (text.includes('[IMAGE:')) {
                const match = text.match(/\[IMAGE:(.*?)\]/);
                if (match && match[1]) {
                  const prompt = match[1];
                  return (
                    <div className={`my-4 rounded-xl overflow-hidden border border-white/10 shadow-lg ${isMariReport ? 'my-12 rounded-none border-zinc-900 shadow-none' : ''}`}>
                      <img 
                        src={`https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=800&height=400&nologo=true`} 
                        alt={prompt} 
                        className="w-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  );
                }
              }
            }

            return (
              <div className={`${isMariReport ? 'mb-10 text-zinc-200 leading-[1.9] text-xl font-serif text-justify' : 'mb-4 text-zinc-300 leading-relaxed text-xs'} ${isMariReport && index === 0 ? 'first-paragraph' : ''}`}>
                {children}
              </div>
            );
          },
          h1: ({ children }) => <h1 className={isMariReport ? 'text-6xl font-serif font-black text-white leading-[1.05] tracking-tight mb-16 border-b-4 border-white pb-8 mt-24' : 'text-2xl font-semibold mb-4 mt-6 tracking-tight text-white'}>{children}</h1>,
          h2: ({ children }) => <h2 className={isMariReport ? 'text-4xl font-serif font-black text-white mb-10 mt-20 border-b border-zinc-800 pb-4 tracking-tight' : 'text-xl font-semibold mb-3 mt-5 tracking-tight text-white'}>{children}</h2>,
          h3: ({ children }) => <h3 className={isMariReport ? 'text-2xl font-serif font-bold italic text-zinc-300 mb-8 mt-14 tracking-tight' : 'text-lg font-medium mb-2 mt-4 tracking-tight text-white'}>{children}</h3>,
          ul: ({ children }) => <ul className={isMariReport ? 'my-10 space-y-4 pl-8 border-l border-zinc-800' : 'list-disc marker:text-indigo-500 mb-4 space-y-2 pl-5 text-zinc-300'}>{children}</ul>,
          ol: ({ children }) => <ol className={isMariReport ? 'my-10 space-y-4 pl-8 border-l border-zinc-800' : 'list-decimal marker:text-indigo-500 mb-4 space-y-2 pl-5 text-zinc-300'}>{children}</ol>,
          li: ({ children }) => <li className={`pl-1 leading-relaxed ${isMariReport ? 'text-zinc-200 text-xl font-serif' : ''}`}>{children}</li>,
          strong: ({ children }) => <strong className={`font-bold ${isMariReport ? 'text-white' : 'text-white'}`}>{children}</strong>,
          em: ({ children }) => <em className="italic opacity-90">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className={isMariReport ? 'my-16 py-8 px-10 bg-zinc-900/30 border-l-2 border-white/20 font-serif italic text-2xl text-white leading-relaxed' : 'border-l-4 border-indigo-500 pl-5 py-3 my-6 rounded-none italic opacity-95 bg-zinc-900/30'}>
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline ? (
              <div className="relative my-4 rounded-xl overflow-hidden bg-zinc-950 border border-white/10">
                {match && (
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-white/10">
                    <span className="text-xs font-mono text-zinc-400">{match[1]}</span>
                  </div>
                )}
                <div className="p-4 overflow-x-auto custom-scrollbar">
                  <code className="text-sm font-mono text-zinc-300" {...props}>
                    {children}
                  </code>
                </div>
              </div>
            ) : (
              <code className="bg-zinc-800/50 text-indigo-300 px-1.5 py-0.5 rounded-md text-sm font-mono border border-white/5" {...props}>
                {children}
              </code>
            );
          },
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-2 transition-colors">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
