type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white/70 p-6 text-center">
      <h2 className="text-base font-semibold text-stone-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
