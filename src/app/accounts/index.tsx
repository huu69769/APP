import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, EmptyText, FormScreen, ListRow, Section } from '@/components/form';
import { accountLabel } from '@/components/savings/SavingsView';
import { useQuery } from '@/data/useQuery';
import { formatMoney } from '@/lib/money';

/** 账户列表：每个账户存了多少（按存入记录算）、用在哪些计划 */
export default function AccountsScreen() {
  const { t } = useTranslation();
  const { data } = useQuery(async (r) => {
    const [accounts, deposits, plans] = await Promise.all([
      r.accounts.list(),
      r.deposits.list(),
      r.saving_plans.list(),
    ]);
    return {
      rows: accounts
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((a) => {
          const mine = deposits.filter((d) => d.accountId === a.id);
          const planNames = [
            ...new Set(
              plans
                .filter((p) => p.accountId === a.id || mine.some((d) => d.planId === p.id))
                .map((p) => p.name)
            ),
          ];
          return {
            account: a,
            saved: mine.reduce((s, d) => s + d.amount, 0),
            planNames,
          };
        }),
    };
  }, []);

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('accounts.title') }} />
      <EmptyText>{t('accounts.hint')}</EmptyText>
      <Section>
        {data && data.rows.length === 0 && <EmptyText>{t('accounts.empty')}</EmptyText>}
        {data?.rows.map(({ account, saved, planNames }) => (
          <ListRow
            key={account.id}
            title={accountLabel(account)}
            subtitle={planNames.join('、') || undefined}
            right={formatMoney(saved, account.currency)}
            onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: account.id } })}
          />
        ))}
      </Section>
      <Button
        title={t('accounts.add')}
        onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: 'new' } })}
      />
    </FormScreen>
  );
}
