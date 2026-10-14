export default function FormField({ label, id, icon: Icon, trailing, ...inputProps }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        {Icon && <Icon size={18} className="field__icon" />}
        <input id={id} {...inputProps} />
        {trailing}
      </div>
    </div>
  );
}
