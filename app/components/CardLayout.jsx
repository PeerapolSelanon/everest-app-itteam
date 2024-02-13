const CardLayout = ({ children }) => {
    return (
       <div className="w-full max-w-8xl overflow-hidden rounded-3xl 
bg-[#FFFADD] shadow-lg">
        <div className="px-4 pyy-5 sm:p-6">{children}</div>
       </div>
    );
};

export default CardLayout;