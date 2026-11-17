// Un solo juego de iconos: Lucide (trazo fino, sin relleno). Tamaño y grosor unificados.
import {
  LuArrowRight, LuArrowUpRight, LuAudioLines, LuBell, LuBox, LuCalendarCheck, LuCamera, LuCheck, LuChevronLeft,
  LuCircleCheck, LuCircleX, LuCopy, LuCreditCard, LuDownload, LuFileAudio, LuFilePen, LuGuitar, LuHeadphones,
  LuImage, LuLock, LuMail, LuMaximize, LuMenu, LuMic, LuMinimize, LuMove, LuMusic, LuPause, LuPlay, LuQrCode,
  LuSave, LuShieldCheck, LuStar, LuTicket, LuTrash2, LuUpload, LuUsers, LuVideo, LuVolume2, LuVolumeX, LuWallet,
  LuX, LuMapPin, LuPhone, LuClock
} from 'react-icons/lu';

const make = (Icon) => function IcWrapper({ size = 18, strokeWidth = 1.75, ...props }) {
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...props} />;
};

export const IcArrowRight = make(LuArrowRight);
export const IcArrowUpRight = make(LuArrowUpRight);
export const IcAudio = make(LuAudioLines);
export const IcBell = make(LuBell);
export const IcCube = make(LuBox);
export const IcCalendar = make(LuCalendarCheck);
export const IcCamera = make(LuCamera);
export const IcCheck = make(LuCheck);
export const IcChevronLeft = make(LuChevronLeft);
export const IcCheckCircle = make(LuCircleCheck);
export const IcXCircle = make(LuCircleX);
export const IcCopy = make(LuCopy);
export const IcCard = make(LuCreditCard);
export const IcDownload = make(LuDownload);
export const IcAudioFile = make(LuFileAudio);
export const IcContract = make(LuFilePen);
export const IcGuitar = make(LuGuitar);
export const IcHeadphones = make(LuHeadphones);
export const IcImage = make(LuImage);
export const IcLock = make(LuLock);
export const IcMail = make(LuMail);
export const IcMaximize = make(LuMaximize);
export const IcMenu = make(LuMenu);
export const IcMic = make(LuMic);
export const IcMinimize = make(LuMinimize);
export const IcMove = make(LuMove);
export const IcMusic = make(LuMusic);
export const IcPause = make(LuPause);
export const IcPlay = make(LuPlay);
export const IcQr = make(LuQrCode);
export const IcSave = make(LuSave);
export const IcShield = make(LuShieldCheck);
export const IcStar = make(LuStar);
export const IcTicket = make(LuTicket);
export const IcTrash = make(LuTrash2);
export const IcUpload = make(LuUpload);
export const IcUsers = make(LuUsers);
export const IcVideo = make(LuVideo);
export const IcVolume = make(LuVolume2);
export const IcMute = make(LuVolumeX);
export const IcWallet = make(LuWallet);
export const IcX = make(LuX);
export const IcPin = make(LuMapPin);
export const IcPhone = make(LuPhone);
export const IcClock = make(LuClock);
