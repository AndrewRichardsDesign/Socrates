import { useMemo } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { parseBookContent, FrontMatterSection } from '@/lib/frontMatterParser';
import { BookOpen, FileText, MessageSquare, Heart, Users, Quote, User } from 'lucide-react';

interface FrontMatterAccordionProps {
  content: string;
  onJumpToChapter1?: () => void;
}

const SECTION_ICONS: Record<FrontMatterSection['type'], React.ReactNode> = {
  introduction: <BookOpen className="h-4 w-4" />,
  preface: <FileText className="h-4 w-4" />,
  foreword: <MessageSquare className="h-4 w-4" />,
  prologue: <BookOpen className="h-4 w-4" />,
  dedication: <Heart className="h-4 w-4" />,
  acknowledgments: <Users className="h-4 w-4" />,
  contents: <FileText className="h-4 w-4" />,
  epigraph: <Quote className="h-4 w-4" />,
  author: <User className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
};

const SECTION_LABELS: Record<FrontMatterSection['type'], string> = {
  introduction: 'Introduction',
  preface: 'Preface',
  foreword: 'Foreword',
  prologue: 'Prologue',
  dedication: 'Dedication',
  acknowledgments: 'Acknowledgments',
  contents: 'Table of Contents',
  epigraph: 'Epigraph',
  author: 'Author',
  other: 'Note',
};

export function FrontMatterAccordion({ content }: FrontMatterAccordionProps) {
  const parsed = useMemo(() => parseBookContent(content), [content]);
  
  const hasDedication = !!parsed.dedication;
  const hasEpigraph = !!parsed.epigraph;
  const hasFrontMatterSections = parsed.frontMatter.length > 0;
  
  if (!hasFrontMatterSections && !hasDedication && !hasEpigraph) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 px-4">
      {hasFrontMatterSections && (
        <Accordion type="multiple" className="w-full mb-4">
          {parsed.frontMatter.map((section, index) => (
            <AccordionItem 
              key={`${section.type}-${index}`} 
              value={`${section.type}-${index}`}
              className="border border-border/50 rounded-lg mb-2 bg-muted/30 overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {SECTION_ICONS[section.type]}
                  </span>
                  <span className="font-medium text-sm">
                    {section.title || SECTION_LABELS[section.type]}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {formatSectionContent(section.content)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      
      {hasDedication && (
        <div className="mb-4 p-4 bg-muted/20 rounded-lg border border-border/30">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Heart className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Dedication</span>
          </div>
          <p className="text-sm italic text-center">{parsed.dedication}</p>
        </div>
      )}
      
      {hasEpigraph && (
        <div className="mb-4 p-4 bg-muted/20 rounded-lg border border-border/30">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Quote className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Epigraph</span>
          </div>
          <div className="text-sm italic text-center whitespace-pre-wrap leading-relaxed">
            {parsed.epigraph}
          </div>
        </div>
      )}
    </div>
  );
}

function formatSectionContent(content: string): string {
  const lines = content.split('\n');
  if (lines.length > 1) {
    return lines.slice(1).join('\n').trim();
  }
  return content.trim();
}

export function getChapter1StartIndex(content: string): number {
  const parsed = parseBookContent(content);
  return parsed.chapter1StartIndex;
}

export function hasFrontMatter(content: string): boolean {
  const parsed = parseBookContent(content);
  return parsed.frontMatter.length > 0;
}
