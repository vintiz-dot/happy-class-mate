import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:glass-premium group-[.toaster]:rounded-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:animate-slide-up-fade",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:glass-sm group-[.toast]:bg-primary/90 group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:transition-all group-[.toast]:duration-300 group-[.toast]:hover:scale-105 group-[.toast]:active:scale-95 group-[.toast]:premium-click",
          cancelButton: "group-[.toast]:glass-sm group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:transition-all group-[.toast]:duration-300 group-[.toast]:hover:scale-105 group-[.toast]:active:scale-95 group-[.toast]:premium-click",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
