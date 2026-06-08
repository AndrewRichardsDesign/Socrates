import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContentGeneratorProps {
  onGenerate: (title: string, content: string) => void;
}

export function ContentGenerator({ onGenerate }: ContentGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    try {
      // Use Wikipedia API for "generation"
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&origin=*&titles=${encodeURIComponent(topic)}`
      );
      const data = await response.json();
      const pages = data.query?.pages;
      
      if (!pages) {
         throw new Error("No pages found");
      }

      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];

      if (pageId === "-1" || !page.extract) {
         toast({
          title: "Topic not found",
          description: "Could not find a Wikipedia article for this topic. Try something more specific.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      onGenerate(page.title, page.extract);
      setOpen(false);
      setTopic("");
      toast({
        title: "Content Generated",
        description: `Created practice text about ${page.title}`,
      });

    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to fetch content. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 h-8 text-xs font-medium bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Generate Practice Text
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-lg overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Generate Practice Content</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter a topic to create a reading passage from Wikipedia.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic" className="text-xs font-medium text-muted-foreground">
              Topic
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Quantum Physics, Coffee, Rome..."
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/30">
          <Button onClick={handleGenerate} disabled={loading || !topic.trim()} size="sm" className="h-8 text-xs font-medium">
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
