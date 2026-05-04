import typography from '@tailwindcss/typography';
declare const _default: {
    content: string[];
    darkMode: "class";
    theme: {
        extend: {
            fontFamily: {
                sans: [string, string, string, string];
            };
            colors: {
                ink: {
                    950: string;
                    900: string;
                    800: string;
                    700: string;
                };
                accent: {
                    50: string;
                    100: string;
                    400: string;
                    500: string;
                    600: string;
                };
            };
            boxShadow: {
                glow: string;
                panel: string;
            };
            backgroundImage: {
                aurora: string;
                'aurora-dark': string;
            };
            animation: {
                float: string;
                pulseSoft: string;
            };
            keyframes: {
                float: {
                    '0%, 100%': {
                        transform: string;
                    };
                    '50%': {
                        transform: string;
                    };
                };
                pulseSoft: {
                    '0%, 100%': {
                        opacity: string;
                    };
                    '50%': {
                        opacity: string;
                    };
                };
            };
        };
    };
    plugins: (typeof typography)[];
};
export default _default;
