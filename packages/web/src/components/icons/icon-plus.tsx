import { IconBase, type IconBaseProps } from './icon-base';

export function IconPlus(props: IconBaseProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </IconBase>
  );
}
