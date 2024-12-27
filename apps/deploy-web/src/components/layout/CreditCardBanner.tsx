export function CreditCardBanner() {
  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">
        Console is experiencing issues causing balance not being reflected accurately. Other functionality should work as expected. Reach out to the console
        team on{" "}
        <a href="https://discord.com/invite/akash" className="text-white underline">
          discord
        </a>
        , if you experience issues.
      </span>
    </div>
  );
}
