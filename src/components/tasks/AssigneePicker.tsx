'use client';

import { useMemo, useState } from 'react';
import { Check, Search, UserPlus, X } from 'lucide-react';
import type { Profile } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AssigneePickerProps {
    users?: Profile[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}

export function AssigneePicker({ users = [], selectedIds, onChange, disabled }: AssigneePickerProps) {
    const [query, setQuery] = useState('');
    const selectedUsers = useMemo(
        () => selectedIds
            .map((id) => users.find((user) => user.id === id))
            .filter(Boolean) as Profile[],
        [selectedIds, users]
    );

    const filteredUsers = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
        if (!normalizedQuery) return users;

        return users.filter((user) => {
            const searchable = [
                user.full_name,
                user.title,
                user.role,
                user.email,
            ].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');

            return searchable.includes(normalizedQuery);
        });
    }, [query, users]);

    const toggleUser = (userId: string) => {
        if (disabled) return;
        if (selectedIds.includes(userId)) {
            onChange(selectedIds.filter((id) => id !== userId));
            return;
        }
        onChange([...selectedIds, userId]);
    };

    const removeUser = (userId: string) => {
        if (disabled) return;
        onChange(selectedIds.filter((id) => id !== userId));
    };

    return (
        <div className="rounded-lg border bg-background">
            <div className="space-y-3 border-b p-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Görevli ara..."
                        className="h-11 pl-9"
                        disabled={disabled}
                    />
                </div>

                {selectedUsers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {selectedUsers.map((user, index) => (
                            <Badge key={user.id} variant={index === 0 ? 'default' : 'secondary'} className="gap-1.5 py-1 pr-1">
                                <span className="max-w-[180px] truncate">{user.full_name}</span>
                                {index === 0 && <span className="text-[10px] opacity-80">Birincil</span>}
                                <button
                                    type="button"
                                    className="rounded-full p-0.5 hover:bg-background/30"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        removeUser(user.id);
                                    }}
                                    aria-label={`${user.full_name} seçimini kaldır`}
                                    disabled={disabled}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserPlus className="h-4 w-4" />
                        <span>Bir veya daha fazla görevli seçebilirsiniz.</span>
                    </div>
                )}
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
                {filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Görevli bulunamadı.</div>
                ) : (
                    <div className="space-y-1">
                        {filteredUsers.map((user) => {
                            const selected = selectedIds.includes(user.id);
                            const selectedIndex = selectedIds.indexOf(user.id);

                            return (
                                <button
                                    key={user.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleUser(user.id)}
                                    className={cn(
                                        'flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                                        selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                                        disabled && 'cursor-not-allowed opacity-60'
                                    )}
                                >
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback>{user.full_name?.charAt(0)?.toUpperCase() ?? '?'}</AvatarFallback>
                                    </Avatar>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{user.full_name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{user.title ?? user.email}</span>
                                    </span>
                                    {selected && (
                                        <span className="flex items-center gap-1 text-xs font-medium">
                                            {selectedIndex === 0 ? 'Birincil' : `${selectedIndex + 1}.`}
                                            <Check className="h-4 w-4" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between border-t px-3 py-2">
                    <span className="text-xs text-muted-foreground">{selectedIds.length} görevli seçildi</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} disabled={disabled}>
                        Temizle
                    </Button>
                </div>
            )}
        </div>
    );
}
