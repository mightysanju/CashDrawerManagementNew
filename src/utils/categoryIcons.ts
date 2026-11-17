import React from 'react';
import {
  Building2,
  AlertTriangle,
  Tag,
  Briefcase,
  Heart,
  Trophy,
  DollarSign,
  Users,
  Bell,
  Wrench,
  Sparkles,
  Coffee,
  Shield,
  Star,
  MessageSquare,
  CheckCircle2,
  Folder,
  FileText
} from 'lucide-react';

export interface CategoryIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { id: 'Building2', label: 'Hotel / Building', icon: Building2 },
  { id: 'AlertTriangle', label: 'Alert / Complaint', icon: AlertTriangle },
  { id: 'Tag', label: 'Tag / Note', icon: Tag },
  { id: 'Briefcase', label: 'Corporate / Business', icon: Briefcase },
  { id: 'Heart', label: 'Guest Care / Hospital', icon: Heart },
  { id: 'Trophy', label: 'Sales / Milestone', icon: Trophy },
  { id: 'DollarSign', label: 'Cash / Revenue', icon: DollarSign },
  { id: 'Users', label: 'Guests / Groups', icon: Users },
  { id: 'Bell', label: 'Front Desk / Bell', icon: Bell },
  { id: 'Wrench', label: 'Maintenance / Engineering', icon: Wrench },
  { id: 'Sparkles', label: 'Housekeeping / Clean', icon: Sparkles },
  { id: 'Coffee', label: 'F&B / Breakfast', icon: Coffee },
  { id: 'Shield', label: 'Security / Safety', icon: Shield },
  { id: 'Star', label: 'VIP / Rating', icon: Star },
  { id: 'MessageSquare', label: 'Feedback / Chat', icon: MessageSquare },
  { id: 'CheckCircle2', label: 'Audit / Verification', icon: CheckCircle2 },
  { id: 'Folder', label: 'Archive / Records', icon: Folder },
  { id: 'FileText', label: 'Document / Report', icon: FileText },
];

export function getCategoryIconComponent(
  iconId?: string,
  fallbackId: string = 'Tag'
): React.ComponentType<{ className?: string; size?: number }> {
  if (iconId) {
    const match = CATEGORY_ICON_OPTIONS.find((item) => item.id === iconId);
    if (match) return match.icon;
  }
  const fallbackMatch = CATEGORY_ICON_OPTIONS.find((item) => item.id === fallbackId);
  return fallbackMatch ? fallbackMatch.icon : Tag;
}
