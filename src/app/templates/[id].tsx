import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import { Button, EmptyText, Field, FormScreen, Input, Section } from '@/components/form';
import { ShiftTimeFields, useShiftTimeState } from '@/components/ShiftTimeFields';
import { useData } from '@/data/DataProvider';

/** 新建 / 编辑班次模板。新建时通过 jobId 参数指定所属兼职 */
export default function TemplateEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; jobId?: string }>();
  const isNew = params.id === 'new';
  const { repos } = useData();

  const [jobId, setJobId] = useState(params.jobId ?? '');
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const times = useShiftTimeState();
  const { setAll } = times;

  useEffect(() => {
    (async () => {
      if (isNew) {
        const job = params.jobId ? await repos.jobs.get(params.jobId) : null;
        if (!job) setMissing(true);
        else setAll({ startTime: '', endTime: '', breakMinutes: job.defaultBreakMinutes });
      } else {
        const tpl = await repos.shift_templates.get(params.id);
        if (!tpl) setMissing(true);
        else {
          setJobId(tpl.jobId);
          setName(tpl.name);
          setAll(tpl);
        }
      }
      setLoaded(true);
    })();
  }, [isNew, params.id, params.jobId, repos, setAll]);

  const nameError = name.trim() ? null : t('errors.nameRequired');

  const save = async () => {
    setShowErrors(true);
    const value = times.validated;
    if (nameError || !value) return;
    try {
      const data = { jobId, name: name.trim(), ...value };
      if (isNew) await repos.shift_templates.create(data);
      else await repos.shift_templates.update(params.id, data);
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('templates.deleteTitle'),
      message: t('templates.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await repos.shift_templates.remove(params.id);
    router.back();
  };

  if (missing) {
    return (
      <FormScreen>
        <EmptyText>{t('errors.notFound')}</EmptyText>
      </FormScreen>
    );
  }
  if (!loaded) return null;

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'templates.newTitle' : 'templates.editTitle') }} />
      <Section>
        <Field label={t('templates.name')} error={showErrors ? nameError : null}>
          <Input value={name} onChangeText={setName} placeholder={t('templates.namePlaceholder')} />
        </Field>
        <ShiftTimeFields state={times} showErrors={showErrors} />
      </Section>
      <Button title={t('common.save')} onPress={save} />
      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}
