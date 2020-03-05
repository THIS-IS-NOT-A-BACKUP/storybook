import React, { FunctionComponent, useMemo, ComponentProps } from 'react';
import { styled, css } from '@storybook/theming';
import { WithTooltip, TooltipLinkList, Button, Icons } from '@storybook/components';

import { HeadingProps } from './Heading';

type MenuButtonProps = ComponentProps<typeof Button> &
  // FIXME: Button should extends from the native <button>
  ComponentProps<'button'> & {
    highlighted: boolean;
  };

const sharedStyles = {
  height: 10,
  width: 10,
  marginLeft: -5,
  marginRight: -5,
  display: 'block',
};

const Icon = styled(Icons)(sharedStyles, ({ theme }) => ({
  color: theme.color.secondary,
}));

const Img = styled.img(sharedStyles);
const Placeholder = styled.div(sharedStyles);

export interface ListItemIconProps {
  icon?: ComponentProps<typeof Icons>['icon'];
  imgSrc?: string;
}

export const MenuItemIcon = ({ icon, imgSrc }: ListItemIconProps) => {
  if (icon) {
    return <Icon icon={icon} />;
  }
  if (imgSrc) {
    return <Img src={imgSrc} alt="image" />;
  }
  return <Placeholder />;
};

const MenuButton = styled(Button)<MenuButtonProps>(({ highlighted, theme }) => ({
  position: 'absolute',
  right: 0,
  top: 0,
  overflow: 'visible',
  padding: 7,

  ...(highlighted && {
    '&:after': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      width: 8,
      height: 8,
      borderRadius: 8,
      background: theme.color.positive,
    },
  }),
}));

const SidebarMenuList: FunctionComponent<{
  menu: HeadingProps['menu'];
  onHide: () => void;
}> = ({ menu, onHide }) => {
  const links = useMemo(() => {
    return menu.map(({ onClick, ...rest }) => ({
      ...rest,
      onClick: () => {
        if (onClick) {
          onClick();
        }
        onHide();
      },
    }));
  }, [menu]);
  return <TooltipLinkList links={links} />;
};

export const SidebarMenu: FunctionComponent<{
  menu: HeadingProps['menu'];
  isHighlighted: boolean;
}> = ({ isHighlighted, menu }) => {
  return (
    <WithTooltip
      placement="top"
      trigger="click"
      closeOnClick
      tooltip={({ onHide }) => <SidebarMenuList onHide={onHide} menu={menu} />}
    >
      <MenuButton outline small containsIcon highlighted={isHighlighted} title="Shortcuts">
        <Icons icon="ellipsis" />
      </MenuButton>
    </WithTooltip>
  );
};
