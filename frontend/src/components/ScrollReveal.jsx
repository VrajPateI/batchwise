import { motion } from 'framer-motion';

export const ScrollReveal = ({ children, delay = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }} // Start slightly down and transparent
            whileInView={{ opacity: 1, y: 0 }} // Animate to final state
            exit={{ opacity: 0, y: -30 }} // Optional: Animate out
            transition={{ duration: 0.6, delay: delay, ease: "easeOut" }}
            viewport={{ once: false, amount: 0.2, margin: "-100px 0px 0px 0px" }} // Margin pushes trigger down
        >
            {children}
        </motion.div>
    );
};
