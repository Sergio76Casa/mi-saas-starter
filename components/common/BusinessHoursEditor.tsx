import React from 'react';
import { BusinessHours, DaySchedule } from '../../types';

interface BusinessHoursEditorProps {
    hours: BusinessHours;
    onChange: (hours: BusinessHours) => void;
    disabled?: boolean;
}

const defaultHours: BusinessHours = {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '14:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true }
};

const dayNames = {
    monday: { es: 'Lunes', ca: 'Dilluns' },
    tuesday: { es: 'Martes', ca: 'Dimarts' },
    wednesday: { es: 'Miércoles', ca: 'Dimecres' },
    thursday: { es: 'Jueves', ca: 'Dijous' },
    friday: { es: 'Viernes', ca: 'Divendres' },
    saturday: { es: 'Sábado', ca: 'Dissabte' },
    sunday: { es: 'Domingo', ca: 'Diumenge' }
};

export const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({ hours = defaultHours, onChange, disabled = false }) => {
    const updateDay = (day: keyof BusinessHours, field: keyof DaySchedule, value: any) => {
        const updated = {
            ...hours,
            [day]: {
                ...hours[day],
                [field]: value
            }
        };
        onChange(updated);
    };

    const days: (keyof BusinessHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return (
        <div className="space-y-2">
            {days.map((day) => {
                const schedule = hours[day] || defaultHours[day];

                return (
                    <div key={day} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                        {/* Día de la semana */}
                        <div className="w-24 shrink-0">
                            <span className="text-[10px] font-black uppercase text-slate-700 tracking-wide">
                                {dayNames[day].es}
                            </span>
                        </div>

                        {/* Toggle Cerrado */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={schedule.closed}
                                onChange={(e) => updateDay(day, 'closed', e.target.checked)}
                                disabled={disabled}
                                className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Cerrado</span>
                        </label>

                        {/* Horarios */}
                        {!schedule.closed && (
                            <>
                                <div className="flex items-center gap-2 flex-1">
                                    <input
                                        type="time"
                                        value={schedule.open}
                                        onChange={(e) => updateDay(day, 'open', e.target.value)}
                                        disabled={disabled}
                                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                    />
                                    <span className="text-[10px] font-black text-slate-300">—</span>
                                    <input
                                        type="time"
                                        value={schedule.close}
                                        onChange={(e) => updateDay(day, 'close', e.target.value)}
                                        disabled={disabled}
                                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                                    />
                                </div>
                            </>
                        )}

                        {schedule.closed && (
                            <div className="flex-1 text-center">
                                <span className="text-[9px] font-bold text-red-400 uppercase italic">Todo el día cerrado</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export { defaultHours };
