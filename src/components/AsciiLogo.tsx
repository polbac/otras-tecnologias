import { useAsciiText, slant } from "react-ascii-text";

type Props = {
  text?: string;
};

export default function AsciiLogo({ text = "OTRAS TECNOLOGIAS" }: Props) {
  const asciiTextRef = useAsciiText({
    font: slant,
    isAnimated: false,
    text,
  });

  return <pre ref={asciiTextRef} className="art" aria-label={`ascii art ${text}`} />;
}
