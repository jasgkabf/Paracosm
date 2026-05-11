import { IconBase, type IconBaseProps } from './icon-base';

export function IconArrowRight(props: IconBaseProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </IconBase>
  );
}
