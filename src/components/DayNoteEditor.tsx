import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useData } from '@/data/DataProvider';
import type { LocalDate } from '@/lib/date';

import { Input, Section } from './form';

const SAVE_DELAY_MS = 800;

/**
 * 当天的笔记（纯文本）。输入后自动保存；清空就删除这条笔记。
 */
export function DayNoteEditor({ date }: { date: LocalDate }) {
  const { t } = useTranslation();
  const { repos } = useData();
  const [text, setText] = useState<string | null>(null);
  const noteId = useRef<string | null>(null);
  const saved = useRef('');
  const latest = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    repos.day_notes.listByDateRange(date, date).then((notes) => {
      const note = notes[0];
      noteId.current = note?.id ?? null;
      saved.current = note?.content ?? '';
      latest.current = saved.current;
      setText(saved.current);
    });
  }, [date, repos]);

  const save = async () => {
    if (timer.current) clearTimeout(timer.current);
    const content = latest.current.trim();
    if (content === saved.current.trim()) return;
    saved.current = latest.current;
    if (noteId.current) {
      if (content) await repos.day_notes.update(noteId.current, { content: latest.current });
      else {
        await repos.day_notes.remove(noteId.current);
        noteId.current = null;
      }
    } else if (content) {
      noteId.current = (await repos.day_notes.create({ date, content: latest.current })).id;
    }
  };

  // 离开页面时保存还没保存的内容
  useEffect(
    () => () => {
      save();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (text === null) return null;

  return (
    <Section title={t('day.note')}>
      <Input
        value={text}
        onChangeText={(v) => {
          setText(v);
          latest.current = v;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(save, SAVE_DELAY_MS);
        }}
        onBlur={save}
        placeholder={t('day.notePlaceholder')}
        multiline
      />
    </Section>
  );
}
