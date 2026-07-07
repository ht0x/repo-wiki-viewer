import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import Mermaid from "./Mermaid";

interface Props {
  content: string;
  resolveLink: (href: string) => string | null;
  onNavigate: (pagePath: string) => void;
}

function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

export default function MarkdownView({
  content,
  resolveLink,
  onNavigate,
}: Props) {
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const lang = match?.[1]?.toLowerCase();
      const text = String(children).replace(/\n$/, "");
      const isBlock = className != null || text.includes("\n");

      if (
        isBlock &&
        (lang === "mermaid" ||
          /^\s*(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram)/.test(
            text,
          ))
      ) {
        return <Mermaid code={text} />;
      }
      if (!isBlock) {
        return (
          <code className="inline-code" {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    a({ href, children, ...props }) {
      const resolved = href ? resolveLink(href) : null;
      if (resolved) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(resolved);
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      const external = href && /^(https?:)?\/\//.test(href);
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {stripFrontmatter(content)}
      </ReactMarkdown>
    </div>
  );
}
