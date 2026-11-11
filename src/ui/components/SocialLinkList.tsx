"use client";
import "./socialLinks.css";
import {
  SocialLink,
  socialLinkName,
} from "@/src/domain/entities/SocialLinks";
import { SocialIcon } from "./SocialIcon";

/**
 * The owner's profiles elsewhere as a row of small drawings. Each opens in a new tab,
 * without telling the other site where the visitor came from, and is named for screen
 * readers and in its tooltip. Nothing renders without links.
 */
export function SocialLinkList({
  links,
  label = "Elsewhere",
  className = "",
  size,
  inert,
}: {
  links: SocialLink[];
  label?: string;
  className?: string;
  size?: number;
  /** A drawing of the row (General's preview): no links to follow or focus. */
  inert?: boolean;
}) {
  if (!links.length) return null;
  return (
    <ul className={`social-links ${className}`.trim()} aria-label={label}>
      {links.map((link, index) => {
        const name = socialLinkName(link);
        return (
          <li key={`${link.url}-${index}`}>
            {inert ? (
              <span className="social-links__item" title={name}>
                <SocialIcon kind={link.kind} size={size} />
              </span>
            ) : (
              <a
                className="social-links__item"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={name}
                aria-label={`${name} (opens in a new tab)`}
              >
                <SocialIcon kind={link.kind} size={size} />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
