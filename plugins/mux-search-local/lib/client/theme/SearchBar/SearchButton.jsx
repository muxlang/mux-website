import { useMemo } from "react";
import * as React from "react";
import "./SearchButton.css";
import { IconSearch } from "../SearchModal/icons";
function ControlKeyIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" className="DocSearch-Control-Key-Icon">
      <path
        d="M4.505 4.496h2M5.505 5.496v5M8.216 4.496l.055 5.993M10 7.5c.333.333.5.667.5 1v2M12.326 4.5v5.996M8.384 4.496c1.674 0 2.116 0 2.116 1.5s-.442 1.5-2.116 1.5M3.205 9.303c-.09.448-.277 1.21-1.241 1.203C1 10.5.5 9.513.5 8V7c0-1.57.5-2.5 1.464-2.494.964.006 1.134.598 1.24 1.342M12.553 10.5h1.953"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  );
}
const ACTION_KEY_DEFAULT = "Ctrl";
const ACTION_KEY_APPLE = "⌘";
function isAppleDevice() {
  return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
}
export const SearchButton = React.forwardRef(({ translations = {}, ...props }, ref) => {
  const { buttonText = "Search", buttonAriaLabel = "Search" } = translations;
  const key = useMemo(() => {
    if (typeof navigator !== "undefined") {
      return isAppleDevice() ? ACTION_KEY_APPLE : ACTION_KEY_DEFAULT;
    }
    return null;
  }, []);
  const [actionKeyAltText, actionKeyChild] =
    key === ACTION_KEY_DEFAULT
      ? // eslint-disable-next-line react/jsx-key -- false flag
        ["Control", <ControlKeyIcon />]
      : ["Meta", key];
  const shortcut = `${actionKeyAltText}+k`;
  return (
    <button
      type="button"
      className="DocSearch DocSearch-Button"
      aria-label={`${buttonAriaLabel} (${shortcut})`}
      aria-keyshortcuts={shortcut}
      {...props}
      ref={ref}
    >
      <span className="DocSearch-Button-Container">
        <IconSearch className="DocSearch-Search-Icon" />
        <span className="DocSearch-Button-Placeholder">{buttonText}</span>
      </span>

      <span className="DocSearch-Button-Keys">
        {key !== null && (
          <>
            <span className="DocSearch-Button-Key">{actionKeyChild}</span>
            <span className="DocSearch-Button-Key">K</span>
          </>
        )}
      </span>
    </button>
  );
});
SearchButton.displayName = "SearchButton";
