import { IconBase, type IconBaseProps } from './icon-base';

export function IconX(props: IconBaseProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}
