import React, { useState } from 'react';
import { Building2, Edit2, Save } from 'lucide-react';

interface OrganizationHeaderProps {
  organizationName: string;
  onSave: (name: string) => void;
}

export function OrganizationHeader({ organizationName, onSave }: OrganizationHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(organizationName);

  const handleSave = () => {
    onSave(editedName);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 mb-6">
      <Building2 size={24} className="text-gray-600" />
      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="flex-1 p-2 border rounded-lg"
            placeholder="Organization Name"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Save size={20} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xl font-semibold">
            {organizationName || 'Add Organization Name'}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Edit2 size={20} />
          </button>
        </div>
      )}
    </div>
  );
}