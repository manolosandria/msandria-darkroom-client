"use client";
import "./socialLinks.css";
import {
  maxSocialLinkLabel,
  maxSocialLinks,
  maxSocialLinkUrl,
  SocialLink,
  SocialLinkKind,
  socialLinkKinds,
  socialLinkNames,
  socialLinkProblem,
} from "@/src/domain/entities/SocialLinks";
import { Choice, ChoiceMenu } from "./ChoiceMenu";
import { SocialIcon } from "./SocialIcon";

const kindChoices: Choice<SocialLinkKind>[] = socialLinkKinds.map((kind) => ({
  value: kind,
  label: socialLinkNames[kind],
  icon: <SocialIcon kind={kind} size={18} />,
}));

/** The networks offered first, in the order the owner asked for them. */
const suggested: SocialLinkKind[] = ["linkedin", "instagram", "youtube"];

/**
 * Curator → General → Social links: up to twelve links, each a network (or a website,
 * or another destination with its own name), its https address and an optional name,
 * reordered with ↑ ↓ and removed with ×. A problem shows under its link once there is
 * an address, or for every link after a refused save (`showAll`).
 */
export function SocialLinksEditor({
  links,
  onChange,
  showAll = false,
}: {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
  showAll?: boolean;
}) {
  const update = (index: number, next: Partial<SocialLink>) =>
    onChange(
      links.map((link, at) => (at === index ? { ...link, ...next } : link)),
    );
  const move = (index: number, by: number) => {
    const next = [...links];
    const [link] = next.splice(index, 1);
    next.splice(index + by, 0, link);
    onChange(next);
  };
  const unused =
    suggested.find((kind) => !links.some((link) => link.kind === kind)) ??
    "website";
  return (
    <div className="social-editor">
      {links.length === 0 && (
        <p className="site-general__hint">
          No links yet. They show as small icons at the end of the public pages
          and in the page menu beside Contact.
        </p>
      )}
      <ol className="social-editor__list">
        {links.map((link, index) => {
          const name = socialLinkNames[link.kind];
          const problem =
            showAll || link.url.trim() ? socialLinkProblem(link) : null;
          const problemId = `social-link-problem-${index}`;
          return (
            <li key={index} className="social-editor__row">
              <div className="social-editor__kind">
                <ChoiceMenu
                  ariaLabel={`Network of link ${index + 1}`}
                  value={link.kind}
                  options={kindChoices}
                  onChange={(kind) => update(index, { kind })}
                />
              </div>
              <label className="social-editor__field">
                <span>Address</span>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://"
                  maxLength={maxSocialLinkUrl + 20}
                  value={link.url}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? problemId : undefined}
                  onChange={(event) => update(index, { url: event.target.value })}
                />
              </label>
              <label className="social-editor__field">
                <span>
                  Name{link.kind === "other" ? "" : " (optional)"}
                </span>
                <input
                  type="text"
                  placeholder={link.kind === "other" ? "Blog, shop…" : name}
                  maxLength={maxSocialLinkLabel + 10}
                  value={link.label ?? ""}
                  onChange={(event) =>
                    update(index, { label: event.target.value })
                  }
                />
              </label>
              <div className="social-editor__tools">
                <button
                  type="button"
                  aria-label={`Move ${name} link earlier`}
                  title="Earlier"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${name} link later`}
                  title="Later"
                  disabled={index === links.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${name} link`}
                  title="Remove"
                  onClick={() => onChange(links.filter((_, at) => at !== index))}
                >
                  ×
                </button>
              </div>
              {problem && (
                <p id={problemId} className="site-general__warning">
                  {problem}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="social-editor__add"
        disabled={links.length >= maxSocialLinks}
        onClick={() => onChange([...links, { kind: unused, url: "" }])}
      >
        + Add link
      </button>
      {links.length >= maxSocialLinks && (
        <p className="site-general__hint">
          {maxSocialLinks} links at most.
        </p>
      )}
    </div>
  );
}
