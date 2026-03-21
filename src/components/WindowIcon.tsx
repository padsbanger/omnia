import { JSX } from "react";
import { BiLogoGmail } from "react-icons/bi";
import { FaDiscord } from "react-icons/fa";
import { FaFacebookMessenger } from "react-icons/fa";

const IconsDict: Record<string, JSX.Element> = {
  facebook: <FaFacebookMessenger />,
  gmail: <BiLogoGmail />,
  discord: <FaDiscord />,
};

export const WindowIcon = ({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) => {
  return <span className={`text-3xl ${className}`}>{IconsDict[icon]}</span>;
};
