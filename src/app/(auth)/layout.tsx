export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-5 sm:p-8 md:p-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
