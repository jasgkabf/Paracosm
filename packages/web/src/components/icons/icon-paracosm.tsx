import { IconBase, type IconBaseProps } from './icon-base';

export function IconParacosm(props: IconBaseProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
      <path d="M12 2v20" />
      <path d="M2 7l10 5 10-5" />
      <path d="M2 17l10-5 10 5" />
    </IconBase>
  );
}
