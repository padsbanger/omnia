import { JSX } from "react";
import { BiLogoGmail, BiLogoMicrosoftTeams } from "react-icons/bi";
import { FaDiscord, FaTelegramPlane, FaWhatsapp } from "react-icons/fa";
import { FaFacebookMessenger } from "react-icons/fa";
import { SiTradingview } from "react-icons/si";
import { FaSquareXTwitter } from "react-icons/fa6";
import { FaSpotify } from 'react-icons/fa';
import { FaSlack } from 'react-icons/fa6';
import { FiLink } from "react-icons/fi";

const IconsDict: Record<string, JSX.Element> = {
  facebook: <FaFacebookMessenger />,
  gmail: <BiLogoGmail />,
  discord: <FaDiscord />,
  tradingview: <SiTradingview />,
  spotify: <FaSpotify />,
  twitter: <FaSquareXTwitter />,
  slack: <FaSlack />,
  telegram: <FaTelegramPlane />,
  whatsapp: <FaWhatsapp />,
  teams: <BiLogoMicrosoftTeams />,
  link: <FiLink />,
};

export const WindowIcon = ({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) => {
  return (
    <span className={`text-3xl ${className}`}>
      {IconsDict[icon] ?? IconsDict.link}
    </span>
  );
};
