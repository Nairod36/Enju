import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const SonnerToast = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg group-[.toaster]:min-h-[4rem] group-[.toaster]:text-base group-[.toaster]:p-4 group-[.toaster]:min-w-[390px]",
          description: "group-[.toast]:text-gray-600 group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:px-4 group-[.toast]:py-2",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-600 group-[.toast]:px-4 group-[.toast]:py-2",
        },
      }}
      {...props}
    />
  );
};

export { SonnerToast };
