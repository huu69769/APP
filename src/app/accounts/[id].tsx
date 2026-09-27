import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirmAsync, showMessage } from '@/components/confirm';
import { Button, EmptyText, Field, FormScreen, Input, Section, Segmented } from '@/components/form';
import { useData } from '@/data/DataProvider';
import { CURRENCIES, type Account, type Currency, type NewEntity } from '@/data/types';

/** 账户：新建（id = "new"）或编辑。只记名称和卡号后 4 位 */
export default function AccountEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; currency?: string }>();
  const isNew = params.id === 'new';
  const { repos, settings } = useData();
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [currency, setCurrency] = useState<Currency>(
    CURRENCIES.includes(params.currency as Currency)
      ? (params.currency as Currency)
      : settings.defaultCurrency
  );
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(isNew);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (isNew) return;
    repos.accounts.get(params.id).then((a) => {
      if (a) {
        setName(a.name);
        setLast4(a.last4);
        setCurrency(a.currency);
        setNote(a.note);
      }
      setLoaded(true);
    });
  }, [isNew, params.id, repos]);

  const errors = {
    name: name.trim() ? null : t('errors.nameRequired'),
    last4: last4 === '' || /^\d{4}$/.test(last4) ? null : t('accounts.last4Invalid'),
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const data: NewEntity<Account> = { name: name.trim(), last4, currency, note: note.trim() };
    try {
      if (isNew) await repos.accounts.create(data);
      else await repos.accounts.update(params.id, data);
      router.back();
    } catch (e) {
      showMessage(t('common.saveFailed', { message: String(e) }));
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('accounts.deleteTitle'),
      message: t('accounts.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await repos.accounts.remove(params.id);
    router.back();
  };

  if (!loaded) return null;

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t(isNew ? 'accounts.add' : 'accounts.edit') }} />
      <Section>
        <Field label={t('accounts.name')} error={err('name')}>
          <Input value={name} onChangeText={setName} placeholder={t('accounts.namePlaceholder')} />
        </Field>
        <Field label={t('accounts.last4')} error={err('last4')}>
          <Input
            value={last4}
            onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder="1234"
            style={{ width: 100, textAlign: 'center' }}
          />
        </Field>
        <Field label={t('target.currency')}>
          <Segmented
            options={CURRENCIES.map((c) => ({ value: c, label: `${t(`currency.${c}`)} ${c}` }))}
            value={currency}
            onChange={setCurrency}
          />
        </Field>
        <Field label={t('savings.note')}>
          <Input value={note} onChangeText={setNote} multiline />
        </Field>
      </Section>
      <EmptyText>{t('accounts.safety')}</EmptyText>
      <Button title={t('common.save')} onPress={save} />
      {!isNew && <Button variant="danger" title={t('common.delete')} onPress={remove} />}
    </FormScreen>
  );
}
