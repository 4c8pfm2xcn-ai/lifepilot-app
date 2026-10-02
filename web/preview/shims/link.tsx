import { forwardRef, type AnchorHTMLAttributes } from "react";
import { navigate } from "./router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; scroll?: boolean; replace?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, onClick, prefetch: _p, scroll: _s, replace, ...rest }, ref) {
  const token = href.split(/[?#]/)[0].replace(/^\//, "");
  return (
    <a
      ref={ref}
      href={token ? `#${token}` : "#"}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || /^https?:/.test(href)) return;
        e.preventDefault();
        navigate(href, replace);
      }}
      {...rest}
    />
  );
});

export default Link;
