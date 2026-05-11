import { IconBase, type IconBaseProps } from './icon-base';

export function IconSearch(props: IconBaseProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21L16.65 16.65" />
    </IconBase>
  );
}
